'use client'

import { Loader2, RefreshCw, ScanLine } from 'lucide-react'

import { fieldInputClass } from '@/components/field-input'
import { cn } from '@/lib/utils'

/**
 * 图形验证码字段（纯展示，手机注册专用）。
 * 图片 + 输入 + 点图刷新回调 + 错误；图形码态（image/isLoading/error）在稳定层 useSendCode，
 * 本组件只读 props、回调 onChange/onRefresh。base64 data-url 直灌 <img>（不走 next/image）。
 */
export interface CaptchaFieldProps {
  /** base64 data-url 图形码图片；null = 未加载。 */
  image: string | null
  isLoading: boolean
  /** 图形码区错误（取码失败 / CAPTCHA_INVALID·EXPIRED）。 */
  error?: string | null
  value: string
  onChange: (value: string) => void
  /** 点图刷新（换新 captchaId）。 */
  onRefresh: () => void
}

export function CaptchaField({
  image,
  isLoading,
  error,
  value,
  onChange,
  onRefresh,
}: CaptchaFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="captchaCode" className="text-sm font-medium text-slate-700 dark:text-slate-400">
        图形验证码
      </label>
      <div className="relative">
        <ScanLine className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" aria-hidden />
        <input
          id="captchaCode"
          name="captchaCode"
          type="text"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'captchaCode-error' : undefined}
          className={cn(fieldInputClass(!!error), 'pr-[116px]')}
          placeholder="请输入图形验证码"
        />
        {/* 图形码图片：点击即刷新（换新 captchaId）；加载中显 spinner，未取到显刷新图标 */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="刷新图形验证码"
          className="absolute right-2 top-1/2 flex h-9 w-[100px] -translate-y-1/2 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition-colors hover:bg-slate-100 disabled:cursor-wait dark:border-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-slate-400 dark:text-slate-500" aria-hidden />
          ) : image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="点击刷新图形验证码" className="h-full w-full object-contain" />
          ) : (
            <RefreshCw className="size-4 text-slate-400 dark:text-slate-500" aria-hidden />
          )}
        </button>
      </div>
      {error && (
        <p id="captchaCode-error" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
