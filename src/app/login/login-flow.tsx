'use client'

import { useEffect, useState } from 'react'

import { InvalidLinkNotice } from '@/components/invalid-link-notice'
import { LoginScreen } from '@/components/login-screen'
import type { AuthorizeParams } from '@/lib/sso/authorize-params'
import { fetchClientInfo, SsoApiError } from '@/lib/sso/sso-api'
import { useSsoFlow } from '@/lib/sso/use-sso-flow'

/**
 * 登录页客户端组装：client-info 品牌查询（400 → 链接无效错误态；其余失败降级不阻断）
 * + useSsoFlow 登录状态机 → LoginScreen。
 */
export function LoginFlow({ authorizeParams }: { authorizeParams: AuthorizeParams }) {
  const [clientName, setClientName] = useState<string>()
  const [invalidLink, setInvalidLink] = useState(false)
  const { status, error, submit } = useSsoFlow(authorizeParams)

  useEffect(() => {
    let cancelled = false
    fetchClientInfo(authorizeParams.clientId)
      .then((info) => {
        if (!cancelled) setClientName(info.clientName)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        // client_id 无效 = 链接无效；其余失败（网络/5xx）降级为不显示应用名，不阻断登录
        if (e instanceof SsoApiError && e.status === 400) setInvalidLink(true)
      })
    return () => {
      cancelled = true
    }
  }, [authorizeParams.clientId])

  if (invalidLink) return <InvalidLinkNotice />

  return (
    <LoginScreen
      clientName={clientName}
      isLoading={status === 'submitting'}
      error={error}
      onSubmit={(account, password) => {
        void submit(account, password)
      }}
    />
  )
}
