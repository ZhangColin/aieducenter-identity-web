import { useCallback, useRef, useState } from 'react'

import type { AuthorizeParams } from './authorize-params'
import { login } from './sso-api'

export type SsoFlowStatus = 'idle' | 'submitting' | 'success' | 'error'

export interface SsoFlowDeps {
  /** 成功后顶层导航回业务应用；默认 window.location（测试注入）。 */
  navigate?: (url: string) => void
}

export interface SsoFlow {
  status: SsoFlowStatus
  /** 可内联展示的失败文案；无错误为 null。 */
  error: string | null
  submit: (account: string, password: string) => Promise<void>
}

/** 登录流程状态机：idle → submitting → success（顶层导航）/ error（内联文案，可重试）。 */
export function useSsoFlow(authorizeParams: AuthorizeParams, deps?: SsoFlowDeps): SsoFlow {
  const [status, setStatus] = useState<SsoFlowStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const navigate = deps?.navigate

  const submit = useCallback(
    async (account: string, password: string) => {
      if (submittingRef.current) return
      submittingRef.current = true
      setStatus('submitting')
      setError(null)
      const go = navigate ?? ((url: string) => {
        window.location.href = url
      })
      try {
        const { redirectUrl } = await login({ ...authorizeParams, account, password })
        setStatus('success')
        go(redirectUrl)
      } catch (e) {
        submittingRef.current = false
        setStatus('error')
        setError(e instanceof Error ? e.message : '登录失败，请稍后重试')
      }
    },
    [authorizeParams, navigate],
  )

  return { status, error, submit }
}
