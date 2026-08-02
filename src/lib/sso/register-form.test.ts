import { describe, expect, it } from 'vitest'

import { hasRegisterFormErrors, validateRegisterForm } from './register-form'

describe('validateRegisterForm', () => {
  it('accepts a valid email + matching passwords', () => {
    expect(
      validateRegisterForm({
        account: 'demo@aieducenter.com',
        password: 'secret123',
        confirmPassword: 'secret123',
      }),
    ).toEqual({})
  })

  it('accepts a valid phone + matching passwords', () => {
    expect(
      validateRegisterForm({ account: '13800138000', password: 'secret123', confirmPassword: 'secret123' }),
    ).toEqual({})
  })

  it('requires the contact (至少一联络方式)', () => {
    const errors = validateRegisterForm({ account: '  ', password: 'secret123', confirmPassword: 'secret123' })

    expect(errors.account).toBe('请填写邮箱或手机号')
  })

  it('rejects a contact that is neither email nor phone (格式)', () => {
    const errors = validateRegisterForm({
      account: 'not-a-contact',
      password: 'secret123',
      confirmPassword: 'secret123',
    })

    expect(errors.account).toBe('请输入正确的邮箱或手机号')
  })

  it('requires a password (必填)', () => {
    const errors = validateRegisterForm({
      account: 'demo@aieducenter.com',
      password: '',
      confirmPassword: '',
    })

    expect(errors.password).toBe('请设置密码')
  })

  it('requires the confirm password', () => {
    const errors = validateRegisterForm({
      account: 'demo@aieducenter.com',
      password: 'secret123',
      confirmPassword: '',
    })

    expect(errors.confirmPassword).toBe('请再次输入密码')
  })

  it('requires the two passwords to match (两次一致)', () => {
    const errors = validateRegisterForm({
      account: 'demo@aieducenter.com',
      password: 'secret123',
      confirmPassword: 'secret456',
    })

    expect(errors.confirmPassword).toBe('两次输入的密码不一致')
  })

  it('accumulates multiple field errors', () => {
    const errors = validateRegisterForm({ account: '', password: '', confirmPassword: '' })

    expect(errors).toEqual({
      account: '请填写邮箱或手机号',
      password: '请设置密码',
      confirmPassword: '请再次输入密码',
    })
  })
})

describe('hasRegisterFormErrors', () => {
  it('is false for an empty errors object and true otherwise', () => {
    expect(hasRegisterFormErrors({})).toBe(false)
    expect(hasRegisterFormErrors({ account: '请填写邮箱或手机号' })).toBe(true)
  })
})
