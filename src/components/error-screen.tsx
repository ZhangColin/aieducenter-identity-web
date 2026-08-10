import { CircleAlert } from 'lucide-react'

/**
 * /error 兜底页错误态：圆形图标 + 标题 + 文案，无链接（纯引导，BFF 选项 1）。
 * 视觉范式参照 InvalidLinkNotice；文案由稳定层 errorNotice 决定（不透传 OIDC 串）。
 * 纯展示：props in，不识 URL/fetch。
 */
export function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-primary/10">
        <CircleAlert className="size-7 text-primary" aria-hidden />
      </div>
      <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  )
}
