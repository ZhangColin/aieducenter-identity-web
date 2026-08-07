import { useCallback, useRef, useState } from 'react'

import type { AuthorizeParams } from './authorize-params'
import { SsoApiError, login, type LoginResult } from './sso-api'

export type SsoFlowStatus = 'idle' | 'submitting' | 'success' | 'error'

/**
 * 提交值接缝：登录/注册共用一个状态机，故字段名按「联络方式」统一为 contact。
 * code 为注册强制当场验码（ADR-0001）——密码登录不填（可选），注册页必填。
 */
export interface SsoSubmitValues {
  contact: string
  /** 动态验证码；密码登录不填，注册必填（register 动作归类为 emailCode/phoneCode）。 */
  code?: string
  password: string
}

/** 提交动作：登录页默认密码登录，注册页注入 register（同一状态机复用）。 */
export type SsoSubmitAction = (
  authorizeParams: AuthorizeParams,
  values: SsoSubmitValues,
) => Promise<LoginResult>

const loginAction: SsoSubmitAction = (authorizeParams, { contact, password }) =>
  login({ ...authorizeParams, account: contact, password })

export interface SsoFlowDeps {
  /** 成功后顶层导航回业务应用；默认 window.location（测试注入）。 */
  navigate?: (url: string) => void
  /** 提交动作；默认密码登录（测试与注册页注入）。 */
  action?: SsoSubmitAction
}

export interface SsoFlow {
  status: SsoFlowStatus
  /** 提交失败：message 可直接内联展示、field 预留字段级错误（本期恒 undefined）；无错误为 null。 */
  error: SsoApiError | null
  submit: (values: SsoSubmitValues) => Promise<void>
}

/** 登录/注册流程状态机：idle → submitting → success（顶层导航）/ error（内联文案，可重试）。 */
export function useSsoFlow(authorizeParams: AuthorizeParams, deps?: SsoFlowDeps): SsoFlow {
  const [status, setStatus] = useState<SsoFlowStatus>('idle')
  const [error, setError] = useState<SsoApiError | null>(null)
  const submittingRef = useRef(false)
  const navigate = deps?.navigate
  const action = deps?.action ?? loginAction

  const submit = useCallback(
    async (values: SsoSubmitValues) => {
      if (submittingRef.current) return
      submittingRef.current = true
      setStatus('submitting')
      setError(null)
      const go = navigate ?? ((url: string) => {
        window.location.href = url
      })
      try {
        const { redirectUrl } = await action(authorizeParams, values)
        setStatus('success')
        go(redirectUrl)
      } catch (e) {
        submittingRef.current = false
        setStatus('error')
        setError(toSsoApiError(e))
      }
    },
    [authorizeParams, navigate, action],
  )

  return { status, error, submit }
}

/** 把 action 抛出的任意值收敛为 SsoApiError：SsoApiError 原样透传，其余取 message（非 Error 走兜底文案）。 */
function toSsoApiError(e: unknown): SsoApiError {
  if (e instanceof SsoApiError) return e
  return new SsoApiError(e instanceof Error ? e.message : '操作失败，请稍后重试')
}
