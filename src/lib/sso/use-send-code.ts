'use client'

import { useCallback, useRef, useState } from 'react'

import type { SendCodeResult, VerificationPurpose } from './verification-code'
import { sendEmailCode } from './verification-code'
import { SsoApiError } from './sso-api'
import { useCountdown } from './use-countdown'

export type SendCodeStatus = 'idle' | 'sending' | 'sent' | 'error'

export interface UseSendCodeDeps {
  /** 发码实现；默认 sendEmailCode（测试注入）。 */
  send?: (email: string, purpose: VerificationPurpose) => Promise<SendCodeResult>
  /** 验证码【目的】；默认 REGISTER（注册页），登录页 #8 传 LOGIN。 */
  purpose?: VerificationPurpose
}

export interface UseSendCode {
  status: SendCodeStatus
  /** 冷却剩余秒数（组合 useCountdown）；0 表示可重发。 */
  remainingSeconds: number
  /** 发码失败的内联文案；无错误为 null。 */
  error: string | null
  /** 发码：sending/冷却中忽略。contact 由调用方提供（联络方式变更时调 reset）。 */
  send: (contact: string) => Promise<void>
  /** 重置冷却与状态（联络方式变更时调用，换桶）。 */
  reset: () => void
}

/**
 * 发码流程：status `idle/sending/sent/error` + 持有冷却（组合 useCountdown）。
 * 本期实现邮箱分支；#8 登录验证码登录复用本 hook，仅换 purpose=LOGIN。
 * 稳定层纯 TS：UI 调 send(contact)/reset()，本 hook 管状态机与冷却。
 */
export function useSendCode(deps?: UseSendCodeDeps): UseSendCode {
  const doSend = deps?.send ?? sendEmailCode
  const purpose = deps?.purpose ?? 'REGISTER'
  const countdown = useCountdown()
  const [status, setStatus] = useState<SendCodeStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const sendingRef = useRef(false)

  const reset = useCallback(() => {
    sendingRef.current = false
    setError(null)
    setStatus('idle')
    countdown.reset()
  }, [countdown])

  const send = useCallback(
    async (contact: string) => {
      // 发送中或冷却中忽略（UI 已禁点，此为兜底）
      if (sendingRef.current || countdown.isRunning) return
      sendingRef.current = true
      setStatus('sending')
      setError(null)
      try {
        const { cooldownSeconds } = await doSend(contact, purpose)
        setStatus('sent')
        countdown.start(cooldownSeconds)
      } catch (e: unknown) {
        setStatus('error')
        setError(toMessage(e))
      } finally {
        sendingRef.current = false
      }
    },
    [countdown, doSend, purpose],
  )

  return { status, remainingSeconds: countdown.remaining, error, send, reset }
}

/** 把发码异常收敛为可内联展示的文案：sendEmailCode 已把所有失败收敛为 SsoApiError，故仅信它；其余（非预期）走兜底，不泄漏原始 message。 */
function toMessage(e: unknown): string {
  if (e instanceof SsoApiError) return e.message
  return '操作失败，请稍后重试'
}
