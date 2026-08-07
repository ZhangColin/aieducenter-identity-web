import { cn } from '@/lib/utils'

/**
 * 认证表单输入框统一样式：左图标槽（pl-10）+ 错误/正常态边框与聚焦环。
 * register-screen / captcha-field 共用——UI 改版集中改这一处，避免各组件副本漂移。
 */
export function fieldInputClass(hasError: boolean): string {
  return cn(
    'w-full rounded-lg border bg-white py-3 pl-10 pr-4 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:ring-2 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
    hasError
      ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20 dark:border-red-800'
      : 'border-slate-200 focus:border-primary focus:ring-primary/20 dark:border-slate-700',
  )
}
