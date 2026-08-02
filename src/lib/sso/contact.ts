/**
 * 联络方式归类：注册页单一「手机号/邮箱」输入框 → 后端 email/phone 分离字段。
 * 规则与 identity 后端对齐（邮箱同 VerificationCodeAppService 简化规则，手机号同 hutool isMobile 号段）；
 * 前端只做归类与即时提示，最终格式以后端校验为准（400 {code,message} 内联展示）。
 */
export type Contact = { type: 'email'; value: string } | { type: 'phone'; value: string }

const EMAIL_PATTERN =
  /^[a-zA-Z0-9]([a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/
const PHONE_PATTERN = /^1[3-9]\d{9}$/

/** 解析输入为 email/phone 联络方式；空白与格式不符返回 null。 */
export function parseContact(input: string): Contact | null {
  const value = input.trim()
  if (!value) return null
  if (EMAIL_PATTERN.test(value)) return { type: 'email', value }
  if (PHONE_PATTERN.test(value)) return { type: 'phone', value }
  return null
}
