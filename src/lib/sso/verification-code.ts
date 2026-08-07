import { hasMessage, requestJSON, SsoApiError } from './sso-api'

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
  /** 同一联络方式的重发冷却秒数（成功后自锁窗口）。 */
  cooldownSeconds: number
}

/** 后端 ApiResponse 包装形状（code=HTTP 状态码；成功 data 载荷，错误 data=null）。 */
interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

/**
 * 发送邮箱验证码（`POST /api/account/verification-code/email`，ApiResponse 包装端点）。
 * 成功解包 data 并归一化为 `{expireInSeconds, cooldownSeconds}`；失败抛 SsoApiError（429 限流 / 400 格式 / 网络）。
 */
export async function sendEmailCode(
  email: string,
  purpose: VerificationPurpose,
): Promise<SendCodeResult> {
  const { ok, status, body } = await requestJSON('/api/account/verification-code/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose }),
  })
  if (!ok) {
    throw new SsoApiError(sendCodeErrorMessage(status, body), status)
  }
  const data = unwrapData<{ expireInSeconds: number; resentAfterSeconds: number }>(body)
  return { expireInSeconds: data.expireInSeconds, cooldownSeconds: data.resentAfterSeconds }
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
