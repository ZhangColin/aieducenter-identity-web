import { Network, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * 登录/注册页外壳（stitch「平台登录/注册」设计稿）：左侧品牌区（小屏收起）+ 右侧内容卡片 + 页脚。
 * 纯展示组件，不识 URL/fetch。
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background-light font-display dark:bg-background-dark">
      <div className="flex flex-grow items-center justify-center p-4 sm:p-8">
        <div className="grid min-h-[700px] w-full max-w-[1200px] overflow-hidden rounded-xl border border-transparent bg-white shadow-xl lg:grid-cols-2 dark:border-slate-800 dark:bg-slate-900 dark:shadow-2xl">
          {/* 左侧：平台品牌区（移动端收起） */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-primary/5 p-12 lg:flex">
            <div className="relative z-10">
              <div className="mb-12 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-white">
                  <Network className="size-6" aria-hidden />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  海创元智研云平台
                </h1>
              </div>
              <div className="space-y-6">
                <h2 className="text-4xl font-extrabold leading-tight text-slate-900 dark:text-slate-100">
                  连接智慧 <br />
                  <span className="text-primary">驱动科研创新</span>
                </h2>
                <p className="max-w-md text-lg text-slate-600 dark:text-slate-400">
                  面向教育与企业的统一 AI 智研入口，集成先进算法与海量算力，助力您的研究更进一步。
                </p>
              </div>
            </div>
            <div className="relative z-10 mt-auto">
              <div className="flex items-center gap-4 rounded-lg border border-primary/10 bg-white/80 p-5 backdrop-blur dark:border-slate-700 dark:bg-slate-800">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/20">
                  <ShieldCheck className="size-6 text-primary" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    企业级安全保障
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">端到端加密与数据隔离技术</p>
                </div>
              </div>
            </div>
            {/* 抽象背景装饰 */}
            <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -top-20 -right-20 size-96 rounded-full bg-primary/5 blur-3xl" />
          </div>
          {/* 右侧：内容区 */}
          <div className="flex flex-col justify-center p-8 sm:p-16">
            <div className="mx-auto w-full max-w-md">{children}</div>
          </div>
        </div>
      </div>
      <footer className="mt-auto p-6 text-center">
        <div className="mb-4 flex flex-wrap justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
          <a className="transition-colors hover:text-primary" href="#">
            关于我们
          </a>
          <a className="transition-colors hover:text-primary" href="#">
            服务协议
          </a>
          <a className="transition-colors hover:text-primary" href="#">
            隐私政策
          </a>
          <a className="transition-colors hover:text-primary" href="#">
            联系支持
          </a>
          <a className="transition-colors hover:text-primary" href="#">
            官方博客
          </a>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          © 2026 海创元 (Hai Chuang Yuan). All rights reserved. 京ICP备XXXXXXXX号
        </p>
      </footer>
    </div>
  )
}
