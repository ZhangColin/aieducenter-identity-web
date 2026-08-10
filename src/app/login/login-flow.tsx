'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { InvalidLinkNotice } from '@/components/invalid-link-notice'
import { LoginScreen, type LoginMode } from '@/components/login-screen'
import type { AuthorizeParams } from '@/lib/sso/authorize-params'
import { serializeAuthorizeParams } from '@/lib/sso/authorize-params'
import { loginByCode } from '@/lib/sso/sso-api'
import { useClientInfo } from '@/lib/sso/use-client-info'
import { useSendCode } from '@/lib/sso/use-send-code'
import { useSsoFlow } from '@/lib/sso/use-sso-flow'

/**
 * 登录页客户端组装：client-info 品牌查询（400 → 链接无效错误态；其余失败降级不阻断）
 * + 两种登录方式（tab 切换，issue #8）：
 *   - 密码登录：useSsoFlow 默认 login 动作
 *   - 验证码登录：useSsoFlow 注入 loginByCode 动作（account + code）+ useSendCode（purpose=LOGIN，复用 #7 发码封装）
 * 两方式各持独立状态机；账号字段跨方式共享。「立即注册」携带完整 authorize query 到 /register。
 */
export function LoginFlow({ authorizeParams }: { authorizeParams: AuthorizeParams }) {
  const router = useRouter()
  const { clientName, invalidLink } = useClientInfo(authorizeParams.clientId)
  const [mode, setMode] = useState<LoginMode>('password')

  const passwordFlow = useSsoFlow(authorizeParams)
  const codeFlow = useSsoFlow(authorizeParams, {
    // 验证码登录：contact→account、code 透传（loginByCode 与 /login 同契约，account/code 单字段）
    action: (params, { contact, code }) => loginByCode({ ...params, account: contact, code: code ?? '' }),
  })
  // 复用 #7 发码封装：purpose=LOGIN（与注册 REGISTER 分键，互不串用）
  const sendCode = useSendCode({ purpose: 'LOGIN' })

  if (invalidLink) return <InvalidLinkNotice />

  const activeFlow = mode === 'password' ? passwordFlow : codeFlow

  return (
    <LoginScreen
      clientName={clientName}
      mode={mode}
      onModeChange={setMode}
      isLoading={activeFlow.status === 'submitting'}
      error={activeFlow.error}
      onSubmit={(account, password) => {
        void passwordFlow.submit({ contact: account, password })
      }}
      sendCode={sendCode}
      onCodeSubmit={(account, code) => {
        void codeFlow.submit({ contact: account, code })
      }}
      onNavigateRegister={() => {
        router.push(`/register?${serializeAuthorizeParams(authorizeParams)}`)
      }}
    />
  )
}
