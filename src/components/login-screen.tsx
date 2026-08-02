'use client'

import { CircleAlert, Eye, EyeOff, Loader2, Lock, Network, User } from 'lucide-react'
import { useState } from 'react'

export interface LoginScreenProps {
  /** client-info 提供的应用名；查询失败时不传（降级不显示，不阻断登录）。 */
  clientName?: string
  isLoading: boolean
  /** 内联错误文案（错密码/停用/锁定/网络异常等）；null 表示无错误。 */
  error: string | null
  onSubmit: (account: string, password: string) => void
  /** 传入才渲染「立即注册」入口（注册互跳由后续 ticket 接入）。 */
  onNavigateRegister?: () => void
}

/**
 * 登录表单（stitch「平台登录」右侧卡片）。
 * Phase 1 裁掉设计稿中后端未支持的元素：手机验证码 tab、忘记密码、30天内免登录、微信/钉钉。
 * 纯展示：不识 URL/fetch，props in / callbacks out。
 */
export function LoginScreen({
  clientName,
  isLoading,
  error,
  onSubmit,
  onNavigateRegister,
}: LoginScreenProps) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(account, password)
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
              onChange={(e) => setAccount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="请输入账号"
            />
          </div>
        </div>

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
              className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
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
