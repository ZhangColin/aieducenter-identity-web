'use client'

import { useRouter } from 'next/navigation'

import { InvalidLinkNotice } from '@/components/invalid-link-notice'
import { RegisterScreen } from '@/components/register-screen'
import type { AuthorizeParams } from '@/lib/sso/authorize-params'
import { serializeAuthorizeParams } from '@/lib/sso/authorize-params'
import { register } from '@/lib/sso/sso-api'
import { useClientInfo } from '@/lib/sso/use-client-info'
import { useSsoFlow } from '@/lib/sso/use-sso-flow'

/**
 * 注册页客户端组装：client-info 品牌查询（400 → 链接无效错误态；其余失败降级不阻断）
 * + useSsoFlow（注入 register 动作）→ RegisterScreen；「去登录」携带完整 authorize query 回 /login。
 */
export function RegisterFlow({ authorizeParams }: { authorizeParams: AuthorizeParams }) {
  const router = useRouter()
  const { clientName, invalidLink } = useClientInfo(authorizeParams.clientId)
  const { status, error, submit } = useSsoFlow(authorizeParams, {
    action: (params, account, password) => register({ ...params, contact: account, password }),
  })

  if (invalidLink) return <InvalidLinkNotice />

  return (
    <RegisterScreen
      clientName={clientName}
      isLoading={status === 'submitting'}
      error={error}
      onSubmit={(account, password) => {
        void submit(account, password)
      }}
      onNavigateLogin={() => {
        router.push(`/login?${serializeAuthorizeParams(authorizeParams)}`)
      }}
    />
  )
}
