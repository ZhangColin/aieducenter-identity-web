import { Link2Off } from 'lucide-react'

/** 缺/无效 client_id（或 client-info 400）时的错误态：不渲染表单。 */
export function InvalidLinkNotice() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-primary/10">
        <Link2Off className="size-7 text-primary" aria-hidden />
      </div>
      <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
        登录链接无效，请从应用进入
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        当前链接缺少应用信息，请回到应用内重新发起登录。
      </p>
    </div>
  )
}
