import type { AuthorizeParams } from './authorize-params'

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

/** 登录/注册请求失败：message 已是可直接内联展示的文案。status 缺失 = 网络异常。 */
export class SsoApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'SsoApiError'
    this.status = status
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

/** 同源 /api/* 请求的公共形状：网络异常与 JSON 解析失败统一收敛。 */
async function requestJSON(
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

function hasMessage(body: unknown): body is { message: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { message?: unknown }).message === 'string'
  )
}
