'use client'

import { useRouter } from 'next/navigation'

import { InvalidLinkNotice } from '@/components/invalid-link-notice'
import { RegisterScreen } from '@/components/register-screen'
import type { AuthorizeParams } from '@/lib/sso/authorize-params'
import { serializeAuthorizeParams } from '@/lib/sso/authorize-params'
import { register } from '@/lib/sso/sso-api'
import { useClientInfo } from '@/lib/sso/use-client-info'
import { useSendCode } from '@/lib/sso/use-send-code'
import { useSsoFlow } from '@/lib/sso/use-sso-flow'

/**
 * 注册页客户端组装：client-info 品牌查询（400 → 链接无效错误态；其余失败降级不阻断）
 * + useSsoFlow（注入 register 动作：邮箱带 emailCode / 手机带 phoneCode，已由 sso-api.register 归类）
 * + useSendCode（发码状态机 + 冷却 + 手机分支图形码生命周期，purpose=REGISTER；默认 sendEmailCode/sendSmsCode/fetchCaptcha）
 * → RegisterScreen；「去登录」携带完整 authorize query 回 /login。
 */
export function RegisterFlow({ authorizeParams }: { authorizeParams: AuthorizeParams }) {
  const router = useRouter()
  const { clientName, invalidLink } = useClientInfo(authorizeParams.clientId)
  const { status, error, submit } = useSsoFlow(authorizeParams, {
    action: (params, { contact, password, code }) =>
      // 表单已强制 code/password 必填，此处 ?? '' 仅为类型桥接（防御）
      register({ ...params, contact, password: password ?? '', code: code ?? '' }),
  })
  const sendCode = useSendCode({ purpose: 'REGISTER' })

  if (invalidLink) return <InvalidLinkNotice />

  return (
    <RegisterScreen
      clientName={clientName}
      isLoading={status === 'submitting'}
      error={error}
      sendCode={sendCode}
      onSubmit={(account, password, code) => {
        void submit({ contact: account, password, code })
      }}
      onNavigateLogin={() => {
        router.push(`/login?${serializeAuthorizeParams(authorizeParams)}`)
      }}
    />
  )
}
