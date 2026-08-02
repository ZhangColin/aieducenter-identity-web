'use client'

import { CircleAlert, Loader2, Lock, LockKeyhole, Network, User } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'

import type { RegisterFormErrors, RegisterFormField } from '@/lib/sso/register-form'
import { hasRegisterFormErrors, validateRegisterForm } from '@/lib/sso/register-form'
import { cn } from '@/lib/utils'

export interface RegisterScreenProps {
  /** client-info 提供的应用名；查询失败时不传（降级不显示，不阻断注册）。 */
  clientName?: string
  isLoading: boolean
  /** 内联错误文案（409 冲突/校验错误/网络异常等）；null 表示无错误。 */
  error: string | null
  onSubmit: (account: string, password: string) => void
  /** 传入才渲染「已有账号？立即登录」入口。 */
  onNavigateLogin?: () => void
}

/**
 * 注册表单（stitch「平台注册」右侧卡片）。
 * Phase 1 裁掉设计稿中后端未支持/未就位的元素：验证码、社交登录、服务协议勾选（协议文档未就位）。
 * 纯展示：不识 URL/fetch，props in / callbacks out；字段级校验走稳定层 validateRegisterForm。
 */
export function RegisterScreen({
  clientName,
  isLoading,
  error,
  onSubmit,
  onNavigateLogin,
}: RegisterScreenProps) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<RegisterFormErrors>({})

  function clearFieldError(field: RegisterFormField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errors = validateRegisterForm({ account, password, confirmPassword })
    setFieldErrors(errors)
    if (hasRegisterFormErrors(errors)) return
    onSubmit(account.trim(), password)
  }

  return (
    <div>
      {/* 移动端品牌（小屏时左侧品牌区收起） */}
      <div className="mb-8 flex items-center gap-2 lg:hidden">
        <Network className="size-8 text-primary" aria-hidden />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">海创元智研</h2>
      </div>

      <div className="mb-8">
        <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">创建您的账号</h3>
        <p className="text-slate-500 dark:text-slate-400">
          {clientName ? `注册后继续前往 ${clientName}` : '请填写以下信息完成注册'}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <Field
          id="account"
          label="手机号/邮箱"
          icon={<User className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" aria-hidden />}
          error={fieldErrors.account}
        >
          <input
            id="account"
            name="account"
            type="text"
            autoComplete="email"
            value={account}
            onChange={(e) => {
              setAccount(e.target.value)
              clearFieldError('account')
            }}
            aria-invalid={!!fieldErrors.account}
            aria-describedby={fieldErrors.account ? 'account-error' : undefined}
            className={inputClass(!!fieldErrors.account)}
            placeholder="请输入手机号或邮箱"
          />
        </Field>

        <Field
          id="password"
          label="设置密码"
          icon={<Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" aria-hidden />}
          error={fieldErrors.password}
        >
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearFieldError('password')
            }}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            className={inputClass(!!fieldErrors.password)}
            placeholder="8-20位字符，包含字母及数字"
          />
        </Field>

        <Field
          id="confirmPassword"
          label="确认密码"
          icon={<LockKeyhole className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" aria-hidden />}
          error={fieldErrors.confirmPassword}
        >
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              clearFieldError('confirmPassword')
            }}
            aria-invalid={!!fieldErrors.confirmPassword}
            aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
            className={inputClass(!!fieldErrors.confirmPassword)}
            placeholder="请再次输入密码"
          />
        </Field>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {isLoading ? '注册中…' : '立即注册'}
        </button>
      </form>

      {onNavigateLogin && (
        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          已有账号？
          <button
            type="button"
            onClick={onNavigateLogin}
            className="font-semibold text-primary hover:underline"
          >
            立即登录
          </button>
        </p>
      )}
    </div>
  )
}

function inputClass(hasError: boolean): string {
  return cn(
    'w-full rounded-lg border bg-white py-3 pl-10 pr-4 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:ring-2 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
    hasError
      ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20 dark:border-red-800'
      : 'border-slate-200 focus:border-primary focus:ring-primary/20 dark:border-slate-700',
  )
}

/** 字段组：label + 图标输入框 + 字段级内联错误。 */
function Field({
  id,
  label,
  icon,
  error,
  children,
}: {
  id: string
  label: string
  icon: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-400">
        {label}
      </label>
      <div className="relative">
        {icon}
        {children}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
