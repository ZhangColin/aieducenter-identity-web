'use client'

import { useCallback, useRef, useState } from 'react'

import { parseContact } from './contact'
import { SsoApiError } from './sso-api'
import { useCountdown } from './use-countdown'
import type { Captcha, SendCodeResult, VerificationPurpose } from './verification-code'
import { fetchCaptcha as fetchCaptchaImpl, sendEmailCode, sendSmsCode } from './verification-code'

export type SendCodeStatus = 'idle' | 'sending' | 'sent' | 'error'

export interface UseSendCodeDeps {
  /** 邮箱发码实现；默认 sendEmailCode（测试注入）。 */
  send?: (email: string, purpose: VerificationPurpose) => Promise<SendCodeResult>
  /** 短信发码实现（带一次性图形码）；默认 sendSmsCode（测试注入）。 */
  sendSms?: (
    phone: string,
    purpose: VerificationPurpose,
    captchaId: string,
    captchaCode: string,
  ) => Promise<SendCodeResult>
  /** 取图形码实现；默认 fetchCaptcha（测试注入）。 */
  fetchCaptcha?: () => Promise<Captcha>
  /** 验证码【目的】；默认 REGISTER（注册页），登录页 #8 传 LOGIN。 */
  purpose?: VerificationPurpose
}

/** 图形码视图态（UI 只需图片/加载/错误；captchaId 为一次性内部态，不泄进 UI）。 */
export interface CaptchaState {
  image: string | null
  isLoading: boolean
  /** 图形码区错误：取码失败 / CAPTCHA_INVALID·EXPIRED（发短信 400）。 */
  error: string | null
}

export interface UseSendCode {
  status: SendCodeStatus
  /** 冷却剩余秒数（组合 useCountdown）；0 表示可重发。成功发码武装（429 限流仅展示文案、不武装）。 */
  remainingSeconds: number
  /** 发码失败的内联文案（限流/网络/邮箱域错误）；图形码错误不在此，见 captcha.error。无错误为 null。 */
  error: string | null
  /** 发码：sending/冷却中忽略。contact 由调用方提供（联络方式变更时调 reset）；手机分支另需 captchaCode。 */
  send: (contact: string, captchaCode?: string) => Promise<void>
  /** 重置冷却、状态与图形码（联络方式变更时调用，换桶）。 */
  reset: () => void
  /** 图形码态（手机分支）；邮箱路径不渲染图形码块。 */
  captcha: CaptchaState
  /** 取/刷新图形码（点图刷新 + 判 phone 即取）；清空旧错误后重取。 */
  fetchCaptcha: () => Promise<void>
}

/**
 * 发码流程：status `idle/sending/sent/error` + 持有冷却（组合 useCountdown）+ 手机分支图形码生命周期。
 *
 * 邮箱分支：send(contact) → sendEmailCode。手机分支：判 phone 即取图形码 → send(contact, captchaCode)
 * 走 sendSmsCode（后端 verifyAndDelete 一次性消费 captchaId）→ 每次发码尝试（成功/失败）后自动重取新图形码。
 * 429 限流仅展示文案、不武装冷却（UI 冷却才是防刷主手段；429 是后端兜底节流）。稳定层纯 TS：UI 调 send/fetchCaptcha/reset，本 hook 管状态机。
 * #8 登录验证码登录复用本 hook，仅换 purpose=LOGIN。
 */
export function useSendCode(deps?: UseSendCodeDeps): UseSendCode {
  const doSend = deps?.send ?? sendEmailCode
  const doSendSms = deps?.sendSms ?? sendSmsCode
  const doFetchCaptcha = deps?.fetchCaptcha ?? fetchCaptchaImpl
  const purpose = deps?.purpose ?? 'REGISTER'
  const countdown = useCountdown()
  const [status, setStatus] = useState<SendCodeStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [captchaImage, setCaptchaImage] = useState<string | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const sendingRef = useRef(false)
  /** 一次性 captchaId：发短信时配套校验，不进 UI（UI 只读 captcha.image）。 */
  const captchaIdRef = useRef<string | null>(null)

  const reset = useCallback(() => {
    sendingRef.current = false
    captchaIdRef.current = null
    setCaptchaImage(null)
    setCaptchaLoading(false)
    setCaptchaError(null)
    setError(null)
    setStatus('idle')
    countdown.reset()
  }, [countdown])

  /**
   * 取图形码。preserveError=false（默认/手动刷新/判 phone 即取）先清旧错误；
   * preserveError=true（发码后自动重取）保留 CAPTCHA_INVALID 文案——让用户在新图下看到上次错因。
   */
  const loadCaptcha = useCallback(
    async (opts: { preserveError: boolean }) => {
      if (!opts.preserveError) setCaptchaError(null)
      setCaptchaLoading(true)
      try {
        const captcha = await doFetchCaptcha()
        captchaIdRef.current = captcha.captchaId
        setCaptchaImage(captcha.image)
      } catch {
        captchaIdRef.current = null
        setCaptchaImage(null)
        setCaptchaError('图形码加载失败，点击刷新')
      } finally {
        setCaptchaLoading(false)
      }
    },
    [doFetchCaptcha],
  )

  const fetchCaptcha = useCallback(() => loadCaptcha({ preserveError: false }), [loadCaptcha])

  const send = useCallback(
    async (contact: string, captchaCode?: string) => {
      // 发送中或冷却中忽略（UI 已禁点，此为兜底）
      if (sendingRef.current || countdown.isRunning) return
      const parsed = parseContact(contact)
      if (!parsed) return // UI 已即时校验，兜底
      // 手机分支前置：无未消费图形码不发（UI 已 gating，此为兜底）。必须在进入 'sending' 前——
      // 否则早返回会让 status 卡在 'sending'（按钮恒显「发送中…」无法恢复）
      if (parsed.type === 'phone' && !captchaIdRef.current) {
        setCaptchaError('请先获取图形验证码')
        return
      }
      sendingRef.current = true
      setStatus('sending')
      setError(null)
      setCaptchaError(null)
      try {
        let result: SendCodeResult
        if (parsed.type === 'email') {
          result = await doSend(parsed.value, purpose)
        } else {
          // 上方前置守卫保证此处 captchaId 非空
          result = await doSendSms(parsed.value, purpose, captchaIdRef.current!, captchaCode ?? '')
        }
        setStatus('sent')
        countdown.start(result.cooldownSeconds)
      } catch (e: unknown) {
        setStatus('error')
        const msg = toMessage(e)
        if (e instanceof SsoApiError && e.status === 429) {
          // 429 是后端兜底节流：前端不再武装冷却（UI 冷却才是防刷主手段），仅展示文案
          setError(msg)
        } else if (parsed.type === 'phone' && e instanceof SsoApiError && e.status === 400) {
          // 手机分支 400 = 图形码错/过期（手机号已客户端预校验）→ 图形码区
          setCaptchaError(msg)
        } else {
          setError(msg)
        }
      } finally {
        sendingRef.current = false
        // 一次性契约：手机每次发码尝试（成功/失败）后重取新图形码（保留可能的错因文案）
        if (parsed.type === 'phone') {
          await loadCaptcha({ preserveError: true })
        }
      }
    },
    [countdown, doSend, doSendSms, purpose, loadCaptcha],
  )

  return {
    status,
    remainingSeconds: countdown.remaining,
    error,
    send,
    reset,
    captcha: { image: captchaImage, isLoading: captchaLoading, error: captchaError },
    fetchCaptcha,
  }
}

/** 把发码异常收敛为可内联展示的文案：发码封装已把所有失败收敛为 SsoApiError，故仅信它；其余（非预期）走兜底，不泄漏原始 message。 */
function toMessage(e: unknown): string {
  if (e instanceof SsoApiError) return e.message
  return '操作失败，请稍后重试'
}
