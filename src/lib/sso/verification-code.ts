import { hasMessage, requestJSON, SsoApiError, SSO_API_PREFIX } from './sso-api'

/**
 * 动态验证码【目的】（绑定上下文，跨目的不可复用——注册码不能用于登录）。
 * 与 identity 后端 SendEmailCodeCommand.purpose 对齐。
 */
export type VerificationPurpose = 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD'

/**
 * 发码结果（归一化）：后端 `resentAfterSeconds` 在此映射为 `cooldownSeconds`，
 * 后端字段名不泄漏进 UI/类型（见 CONTEXT.md 术语表【冷却】）。
 */
export interface SendCodeResult {
  /** 验证码有效期秒数。 */
  expireInSeconds: number
  /** 同一联络方式的重发冷却秒数（成功后自锁窗口）；归一化保证始终是有限正整数。 */
  cooldownSeconds: number
}

/** 与后端默认冷却对齐的兜底值（邮箱/手机各自，后端缺省 60s）。 */
const DEFAULT_COOLDOWN_SECONDS = 60

/**
 * 把后端 `resentAfterSeconds` 归一化为有限正整数的 `cooldownSeconds`：
 * 缺失 / 非数字 / 非正时回退默认值，杜绝 `undefined`/`NaN` 流入倒计时导致静默失效。
 */
function normalizeCooldownSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? value
    : DEFAULT_COOLDOWN_SECONDS
}

/**
 * 把发码成功响应体归一化为 `SendCodeResult`：解包 ApiResponse 的 data，
 * 再经 `normalizeCooldownSeconds` 兜底为有限正整数的 `cooldownSeconds`。
 */
function toSendCodeResult(body: unknown): SendCodeResult {
  const data = unwrapData<{ expireInSeconds: number; resentAfterSeconds?: number }>(body)
  return {
    expireInSeconds: data.expireInSeconds,
    cooldownSeconds: normalizeCooldownSeconds(data.resentAfterSeconds),
  }
}

/**
 * 图形验证码（一次性）：后端返回 base64 图片（带 data-url 前缀）+ captchaId。
 * captchaId 用于发短信时配套校验，校验即作废（见 sendSmsCode）。
 */
export interface Captcha {
  captchaId: string
  image: string
}

/** 后端 ApiResponse 包装形状（code=HTTP 状态码；成功 data 载荷，错误 data=null）。 */
interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

/**
 * 发送邮箱验证码（`POST /api/sso/verification-code/email`，ApiResponse 包装端点；path 随 #14 namespace 迁移）。
 * 成功解包 data 并归一化为 `{expireInSeconds, cooldownSeconds}`；失败抛 SsoApiError（429 限流 / 400 格式 / 网络）。
 */
export async function sendEmailCode(
  email: string,
  purpose: VerificationPurpose,
): Promise<SendCodeResult> {
  const { ok, status, body } = await requestJSON(`${SSO_API_PREFIX}/verification-code/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose }),
  })
  if (!ok) {
    throw new SsoApiError(sendCodeErrorMessage(status, body), status)
  }
  return toSendCodeResult(body)
}

/**
 * 发送短信验证码（`POST /api/sso/verification-code/sms`，ApiResponse 包装端点；path 随 #14 namespace 迁移）。
 * 短信路径需先解一张**一次性**图形码：后端 `verifyAndDelete` 在此调用内消费 captchaId/captchaCode，
 * 故每次发码（成功/失败）后调用方都必须重取新图形码（见 use-send-code 的手机分支生命周期）。
 * 成功解包 data 并归一化为 `{expireInSeconds, cooldownSeconds}`；失败抛 SsoApiError
 * （429 限流 / 400 域错误：CAPTCHA_INVALID·CAPTCHA_EXPIRED·手机号格式 / 网络）。
 */
export async function sendSmsCode(
  phone: string,
  purpose: VerificationPurpose,
  captchaId: string,
  captchaCode: string,
): Promise<SendCodeResult> {
  const { ok, status, body } = await requestJSON(`${SSO_API_PREFIX}/verification-code/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, purpose, captchaId, captchaCode }),
  })
  if (!ok) {
    throw new SsoApiError(sendCodeErrorMessage(status, body), status)
  }
  return toSendCodeResult(body)
}

/**
 * 获取图形验证码（`GET /api/sso/captcha`，ApiResponse 包装端点；path 随 #14 namespace 迁移）。
 * 成功解包 data 为 `{captchaId, image}`；失败抛 SsoApiError（网络/非 200）。captchaId 为一次性，发短信时消费。
 */
export async function fetchCaptcha(): Promise<Captcha> {
  const { ok, status, body } = await requestJSON(`${SSO_API_PREFIX}/captcha`, { method: 'GET' })
  if (!ok) {
    throw new SsoApiError('图形验证码获取失败，请刷新重试', status)
  }
  return unwrapData<Captcha>(body)
}

/**
 * ApiResponse 解包辅助：仅作用于包装端点（发码），不影响 register/login 裸体路径（零回归）。
 * 缺 data 或形状不符视为失败——不把协议意外泄漏给 UI。
 */
function unwrapData<T>(body: unknown): T {
  if (
    typeof body === 'object' &&
    body !== null &&
    (body as ApiResponse<T>).data !== null &&
    typeof (body as ApiResponse<T>).data === 'object'
  ) {
    return (body as ApiResponse<T>).data as T
  }
  throw new SsoApiError('验证码发送失败，请稍后重试')
}

/**
 * 发码错误码 → 文案：
 * - 429 限流（邮箱冷却 / IP 节流）与 400 域错误（邮箱格式 / 目的无效）采用后端 message
 * - 其余统一兜底，不泄漏协议细节
 */
function sendCodeErrorMessage(status: number, body: unknown): string {
  if ((status === 429 || status === 400) && hasMessage(body)) return body.message
  return '验证码发送失败，请稍后重试'
}
