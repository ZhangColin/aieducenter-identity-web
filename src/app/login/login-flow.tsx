'use client'

import { useRouter } from 'next/navigation'

import { InvalidLinkNotice } from '@/components/invalid-link-notice'
import { LoginScreen } from '@/components/login-screen'
import type { AuthorizeParams } from '@/lib/sso/authorize-params'
import { serializeAuthorizeParams } from '@/lib/sso/authorize-params'
import { useClientInfo } from '@/lib/sso/use-client-info'
import { useSsoFlow } from '@/lib/sso/use-sso-flow'

/**
 * 登录页客户端组装：client-info 品牌查询（400 → 链接无效错误态；其余失败降级不阻断）
 * + useSsoFlow 登录状态机 → LoginScreen；「立即注册」携带完整 authorize query 到 /register。
 */
export function LoginFlow({ authorizeParams }: { authorizeParams: AuthorizeParams }) {
  const router = useRouter()
  const { clientName, invalidLink } = useClientInfo(authorizeParams.clientId)
  const { status, error, submit } = useSsoFlow(authorizeParams)

  if (invalidLink) return <InvalidLinkNotice />

  return (
    <LoginScreen
      clientName={clientName}
      isLoading={status === 'submitting'}
      error={error}
      onSubmit={(account, password) => {
        void submit({ contact: account, password })
      }}
      onNavigateRegister={() => {
        router.push(`/register?${serializeAuthorizeParams(authorizeParams)}`)
      }}
    />
  )
}
