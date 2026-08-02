import { parseContact } from './contact'

/** 注册表单原始输入（组件字段态）。 */
export interface RegisterFormValues {
  /** 手机号/邮箱（单输入框，提交时由 sso-api 归类为 email/phone 字段）。 */
  account: string
  password: string
  confirmPassword: string
}

export type RegisterFormField = keyof RegisterFormValues

/** 字段级校验错误；键存在即该字段有错。空对象 = 校验通过。 */
export type RegisterFormErrors = Partial<Record<RegisterFormField, string>>

/**
 * 提交前即时校验：联络方式必填 + 格式（email/phone 至少其一由单输入框必填覆盖）、
 * 密码必填、两次密码一致。纯函数，UI 层按字段内联展示。
 */
export function validateRegisterForm(values: RegisterFormValues): RegisterFormErrors {
  const errors: RegisterFormErrors = {}

  if (!values.account.trim()) {
    errors.account = '请填写邮箱或手机号'
  } else if (!parseContact(values.account)) {
    errors.account = '请输入正确的邮箱或手机号'
  }

  if (!values.password) {
    errors.password = '请设置密码'
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = '请再次输入密码'
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = '两次输入的密码不一致'
  }

  return errors
}

export function hasRegisterFormErrors(errors: RegisterFormErrors): boolean {
  return Object.keys(errors).length > 0
}
