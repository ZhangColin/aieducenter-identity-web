'use client'

import { CircleAlert, Eye, EyeOff, Loader2, Lock, Network, ShieldCheck, User } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CaptchaField } from '@/components/captcha-field'
import { fieldInputClass } from '@/components/field-input'
import { parseContact } from '@/lib/sso/contact'
import type { SsoApiError } from '@/lib/sso/sso-api'
import type { UseSendCode } from '@/lib/sso/use-send-code'
import { cn } from '@/lib/utils'

/** 登录方式：password（密码，默认）| code（验证码登录，issue #8）。 */
export type LoginMode = 'password' | 'code'

export interface LoginScreenProps {
  /** client-info 提供的应用名；查询失败时不传（降级不显示，不阻断登录）。 */
  clientName?: string
  /** 当前登录方式。 */
  mode: LoginMode
  onModeChange: (mode: LoginMode) => void
  isLoading: boolean
  /** 内联错误：密码登录整体横幅（login 错误无字段）；验证码登录 field=code 时内联到验证码字段，否则横幅。null 表示无错误。 */
  error: SsoApiError | null
  /** 密码登录提交。 */
  onSubmit: (account: string, password: string) => void
  /** 验证码登录发码控件（复用自 #7 的 useSendCode 视图投影）。 */
  sendCode: UseSendCode
  /** 验证码登录提交（account + code）。 */
  onCodeSubmit: (account: string, code: string) => void
  /** 传入才渲染「立即注册」入口。 */
  onNavigateRegister?: () => void
}

/**
 * 登录表单（stitch「平台登录」右侧卡片）。
 * 两种方式并存，tab 切换（issue #8）：密码登录 / 验证码登录。账号字段跨方式共享。
 * 验证码登录复用 #7 的图形码组件（CaptchaField）与发码封装（useSendCode，purpose=LOGIN）——
 * 手机号发码前先过图形码，邮箱直发；提交 POST /api/auth/login-code（account + code）。
 * 防枚举：错码与账号不存在后端同一 CODE_INVALID → 同一验证码字段同一文案内联，不区分。
 * 纯展示：不识 URL/fetch，props in / callbacks out。
 */
export function LoginScreen({
  clientName,
  mode,
  onModeChange,
  isLoading,
  error,
  onSubmit,
  sendCode,
  onCodeSubmit,
  onNavigateRegister,
}: LoginScreenProps) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const contactType = parseContact(account)?.type
  const isPhone = contactType === 'phone'
  // 解构出稳定原语供 effect 依赖（sendCode.captcha 每渲染是新对象，整体入 deps 会触发循环）
  const { image: captchaImage, isLoading: captchaLoading, error: captchaError } = sendCode.captcha
  const { fetchCaptcha } = sendCode

  // 判 phone 即取图形码（手机验证码登录前置）；邮箱路径完全不出现图形码块。
  // 取码失败后 error 置位，effect 不再自动重试，交由点图刷新（避免循环）。
  useEffect(() => {
    if (mode === 'code' && isPhone && !captchaImage && !captchaLoading && !captchaError) {
      void fetchCaptcha()
    }
  }, [mode, isPhone, captchaImage, captchaLoading, captchaError, fetchCaptcha])

  // 密码登录错误无字段 → 横幅；验证码登录 field=code → 验证码字段内联，其余（停用/锁定/OIDC/网络）→ 横幅。
  const bannerError = error && error.field !== 'code' ? error : null
  // 验证码字段错误：服务端 code 字段错误 > 发码失败文案。
  const codeError = error?.field === 'code' ? error.message : sendCode.error

  // 发码启用：联络方式有效即可发；手机另需已取图形码 + 填了图形码（发短信前置校验 captchaCode）
  const sendDisabled =
    sendCode.status === 'sending' ||
    sendCode.remainingSeconds > 0 ||
    !contactType ||
    (isPhone && (!captchaImage || !captchaCode.trim()))
  const sendLabel =
    sendCode.status === 'sending'
      ? '发送中…'
      : sendCode.remainingSeconds > 0
        ? `${sendCode.remainingSeconds}s 后重发`
        : '发送验证码'

  return (
    <div>
      {/* 移动端品牌（小屏时左侧品牌区收起） */}
      <div className="mb-8 flex items-center gap-2 lg:hidden">
        <Network className="size-8 text-primary" aria-hidden />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">海创元智研</h2>
      </div>

      <div className="mb-8">
        <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">欢迎回来</h3>
        <p className="text-slate-500 dark:text-slate-400">
          {clientName ? `登录后继续前往 ${clientName}` : '登录后进入您的智研空间'}
        </p>
      </div>

      {/* 登录方式切换 */}
      <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {(['password', 'code'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            aria-pressed={mode === m}
            className={cn(
              'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
              mode === m
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {m === 'password' ? '密码登录' : '验证码登录'}
          </button>
        ))}
      </div>

      {bannerError && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {bannerError.message}
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (mode === 'password') onSubmit(account.trim(), password)
          else onCodeSubmit(account.trim(), code.trim())
        }}
      >
        <div className="space-y-2">
          <label htmlFor="account" className="text-sm font-medium text-slate-700 dark:text-slate-400">
            邮箱/手机号
          </label>
          <div className="relative">
            <User
              className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden
            />
            <input
              id="account"
              name="account"
              type="text"
              autoComplete="username"
              required
              value={account}
              onChange={(e) => {
                setAccount(e.target.value)
                // 验证码登录：联络方式变更换桶，重置发码冷却（见 CONTEXT.md 术语表【冷却】）
                if (mode === 'code') sendCode.reset()
              }}
              className={fieldInputClass(false)}
              placeholder="请输入账号"
            />
          </div>
        </div>

        {mode === 'code' && isPhone && (
          <CaptchaField
            image={captchaImage}
            isLoading={captchaLoading}
            error={captchaError}
            value={captchaCode}
            onChange={setCaptchaCode}
            onRefresh={() => void fetchCaptcha()}
          />
        )}

        {mode === 'password' ? (
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-700 dark:text-slate-400"
            >
              登录密码
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden
              />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(fieldInputClass(false), 'pr-12')}
                placeholder="请输入密码"
              />
              <button
                type="button"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                {showPassword ? (
                  <EyeOff className="size-5" aria-hidden />
                ) : (
                  <Eye className="size-5" aria-hidden />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="code" className="text-sm font-medium text-slate-700 dark:text-slate-400">
              验证码
            </label>
            <div className="relative">
              <ShieldCheck
                className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden
              />
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={!!codeError}
                aria-describedby={codeError ? 'code-error' : undefined}
                className={cn(fieldInputClass(!!codeError), 'pr-32')}
                placeholder="请输入验证码"
              />
              <button
                type="button"
                onClick={() => {
                  // 手机分支带图形码；邮箱忽略 captchaCode。发码后清空图形码输入（一次性，旧码已作废）
                  void sendCode
                    .send(account.trim(), captchaCode.trim())
                    .then(() => isPhone && setCaptchaCode(''))
                }}
                disabled={sendDisabled}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent dark:disabled:text-slate-500"
              >
                {sendCode.status === 'sending' && (
                  <Loader2 className="mr-1 inline size-3.5 animate-spin" aria-hidden />
                )}
                {sendLabel}
              </button>
            </div>
            {codeError && (
              <p id="code-error" className="text-sm text-red-600 dark:text-red-400">
                {codeError}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {isLoading ? '登录中…' : '立即登录'}
        </button>
      </form>

      {onNavigateRegister && (
        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          还没有账号？
          <button
            type="button"
            onClick={onNavigateRegister}
            className="font-semibold text-primary hover:underline"
          >
            立即注册
          </button>
        </p>
      )}
    </div>
  )
}
