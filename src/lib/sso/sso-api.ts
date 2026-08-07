import type { AuthorizeParams } from './authorize-params'
import { parseContact } from './contact'

/** 后端契约形状（identity /api/auth/*，详见本仓 CONTEXT.md「对接契约」）。 */
export interface ClientInfo {
  clientId: string
  clientName: string
}

export interface LoginInput extends AuthorizeParams {
  account: string
  password: string
}

export interface LoginResult {
  redirectUrl: string
}

export interface RegisterInput extends AuthorizeParams {
  /** 手机号/邮箱（注册页单输入框；按格式归类为后端 email/phone 字段）。 */
  contact: string
  /** 动态验证码（提交时按联络方式归类为 emailCode/phoneCode；强制当场验码，见 ADR-0001）。 */
  code: string
  password: string
}

/** 登录/注册请求失败：message 已是可直接内联展示的文案。status 缺失 = 网络异常。 */
export class SsoApiError extends Error {
  readonly status?: number
  /**
   * 错误归属字段（contact/code），用于字段级内联错误。
   * 本期（#9 prefactor）恒 undefined——预留，#7 注册接码起才由发码/提交链路设置。
   */
  readonly field?: 'contact' | 'code' | null

  constructor(message: string, status?: number, field?: 'contact' | 'code' | null) {
    super(message)
    this.name = 'SsoApiError'
    this.status = status
    this.field = field
  }
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const { ok, status, body } = await requestJSON('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!ok) {
    throw new SsoApiError(loginErrorMessage(status, body), status)
  }
  if (!hasRedirectUrl(body)) {
    throw new SsoApiError('登录失败，请稍后重试', status)
  }
  return { redirectUrl: body.redirectUrl }
}

/**
 * 注册（注册即登录）：成功 200 {redirectUrl} + Set-Cookie（SSO 会话），顶层导航回业务应用。
 * contact 归类为 email/phone 字段、code 归类为 emailCode/phoneCode——无法归类时不发请求直接报错（UI 已即时校验，此为兜底）。
 * 强制当场验码（ADR-0001）：code 永远必填。
 */
export async function register(input: RegisterInput): Promise<LoginResult> {
  const { contact, code, password, ...authorize } = input
  const parsed = parseContact(contact)
  if (!parsed) {
    throw new SsoApiError('请输入正确的邮箱或手机号')
  }
  const codeKey = parsed.type === 'email' ? 'emailCode' : 'phoneCode'
  const { ok, status, body } = await requestJSON('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...authorize, [parsed.type]: parsed.value, [codeKey]: code, password }),
  })
  if (!ok) {
    throw new SsoApiError(registerErrorMessage(status, body), status, registerErrorField(status, body))
  }
  if (!hasRedirectUrl(body)) {
    throw new SsoApiError('注册失败，请稍后重试', status)
  }
  return { redirectUrl: body.redirectUrl }
}

/** 同源 /api/* 请求的公共形状：网络异常与 JSON 解析失败统一收敛。裸体路径（login/register）与 ApiResponse 包装路径（verification-code）共用。 */
export async function requestJSON(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new SsoApiError('网络异常，请检查网络后重试')
  }
  const body: unknown = await response.json().catch(() => null)
  return { ok: response.ok, status: response.status, body }
}

function hasRedirectUrl(body: unknown): body is LoginResult {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { redirectUrl?: unknown }).redirectUrl === 'string'
  )
}

/** 查询「登录到 XXX 应用」品牌信息。失败抛 SsoApiError（400 = client_id 无效）。 */
export async function fetchClientInfo(clientId: string): Promise<ClientInfo> {
  const { ok, status, body } = await requestJSON(
    `/api/auth/client-info?client_id=${encodeURIComponent(clientId)}`,
  )
  if (!ok) {
    throw new SsoApiError('应用信息查询失败', status)
  }
  return body as ClientInfo
}

/**
 * 错误码 → 文案：
 * - 401 采用后端 message（凭据错/账号不存在同一句「账号或密码错误」= 防枚举；停用/锁定各有明确文案）
 * - 其余统一兜底，不把协议细节（OIDC error、校验英文串）泄漏给用户
 */
function loginErrorMessage(status: number, body: unknown): string {
  if (status === 401 && hasMessage(body)) return body.message
  if (status === 400) return '登录链接无效，请从应用进入'
  return '登录失败，请稍后重试'
}

/**
 * 注册错误码 → 文案：
 * - 409 冲突（邮箱/手机号已被使用）与 400 域校验错误（格式/联络方式缺失）按 {code,message} 采用后端文案
 * - 400 OIDC 形状（{error,error_description}，client_id/redirect_uri 无效）→ 链接无效
 * - 其余统一兜底，不把协议细节泄漏给用户
 */
function registerErrorMessage(status: number, body: unknown): string {
  if ((status === 409 || status === 400) && hasMessage(body)) return body.message
  if (status === 400) return '登录链接无效，请从应用进入'
  return '注册失败，请稍后重试'
}

/**
 * 注册错误归属字段（用于字段级内联）。
 * ⚠️ 契约陷阱：register 错误体只带 {code:<httpStatus>, message}，**不含业务码字符串**
 * （ACCOUNT_007/008、VERIFICATION_CODE_INVALID 仅在后端枚举里，GlobalExceptionHandler 序列化时只放 httpStatus）。
 * 故只能按 httpStatus + 是否 OIDC 形状路由：
 * - 409 → contact（注册唯一 409 = 邮箱/手机号已被使用，ACCOUNT_007/008）
 * - 400 域错误（有 message、非 OIDC）→ code（提交时联络方式已客户端校验，现实中的 400 即验证码错/过期）
 * - 400 OIDC（{error}）/ 其余 → 不归属字段，走顶部横幅
 */
function registerErrorField(status: number, body: unknown): 'contact' | 'code' | undefined {
  if (status === 409) return 'contact'
  if (status === 400 && hasMessage(body)) return 'code'
  return undefined
}

export function hasMessage(body: unknown): body is { message: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { message?: unknown }).message === 'string'
  )
}
