// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SsoApiError } from './sso-api'
import type { SendCodeResult, VerificationPurpose } from './verification-code'
import { useSendCode } from './use-send-code'

const OK: SendCodeResult = { expireInSeconds: 300, cooldownSeconds: 60 }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSendCode', () => {
  it('starts idle with no cooldown and no error', () => {
    const { result } = renderHook(() => useSendCode({ send: vi.fn() }))

    expect(result.current.status).toBe('idle')
    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('transitions idle→sending→sent and starts the cooldown from cooldownSeconds', async () => {
    const send = vi.fn().mockResolvedValue(OK)
    const { result } = renderHook(() => useSendCode({ send }))

    await act(async () => {
      await result.current.send('alice@example.com')
    })

    expect(send).toHaveBeenCalledWith('alice@example.com', 'REGISTER')
    expect(result.current.status).toBe('sent')
    expect(result.current.error).toBeNull()
    expect(result.current.remainingSeconds).toBe(60)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.remainingSeconds).toBe(59)
  })

  it('uses the injected purpose (LOGIN for #8 reuse, not REGISTER)', async () => {
    const send = vi.fn().mockResolvedValue(OK)
    const { result } = renderHook(() =>
      useSendCode({ send, purpose: 'LOGIN' as VerificationPurpose }),
    )

    await act(async () => {
      await result.current.send('alice@example.com')
    })

    expect(send).toHaveBeenCalledWith('alice@example.com', 'LOGIN')
  })

  it('does not arm the cooldown on rate limit (429), only shows the backend message', async () => {
    const send = vi.fn().mockRejectedValue(new SsoApiError('请60秒后再试', 429))
    const { result } = renderHook(() => useSendCode({ send }))

    await act(async () => {
      await result.current.send('alice@example.com')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('请60秒后再试')
    // 429 是后端兜底节流，前端不再武装冷却（UI 冷却才是防刷主手段）；remainingSeconds 保持 0
    expect(result.current.remainingSeconds).toBe(0)
  })

  it('does not arm cooldown on IP-throttle 429 either (message has no digits)', async () => {
    const send = vi.fn().mockRejectedValue(new SsoApiError('发送次数过多，请稍后再试', 429))
    const { result } = renderHook(() => useSendCode({ send }))

    await act(async () => {
      await result.current.send('alice@example.com')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('发送次数过多，请稍后再试')
    expect(result.current.remainingSeconds).toBe(0)
  })

  it('does not arm cooldown on non-rate-limit errors (400)', async () => {
    const send = vi.fn().mockRejectedValue(new SsoApiError('邮箱格式不正确', 400))
    const { result } = renderHook(() => useSendCode({ send }))

    await act(async () => {
      await result.current.send('alice@example.com')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('邮箱格式不正确')
    expect(result.current.remainingSeconds).toBe(0)
  })

  it('falls back to a neutral message when the send throws a non-SsoApiError', async () => {
    const send = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useSendCode({ send }))

    await act(async () => {
      await result.current.send('alice@example.com')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('操作失败，请稍后重试')
  })

  it('ignores send while cooling down', async () => {
    const send = vi.fn().mockResolvedValue(OK)
    const { result } = renderHook(() => useSendCode({ send }))

    await act(async () => {
      await result.current.send('alice@example.com')
    })
    expect(send).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.send('alice@example.com')
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('ignores a second send while one is in flight', async () => {
    let resolveSend!: (r: SendCodeResult) => void
    const send = vi
      .fn()
      .mockImplementation(
        () => new Promise<SendCodeResult>((resolve) => (resolveSend = resolve)),
      )
    const { result } = renderHook(() => useSendCode({ send }))

    let first!: Promise<void>
    act(() => {
      first = result.current.send('alice@example.com')
      void result.current.send('alice@example.com')
    })
    expect(send).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSend(OK)
      await first
    })
  })

  it('reset() clears the cooldown and returns to idle (contact change)', async () => {
    const send = vi.fn().mockResolvedValue(OK)
    const { result } = renderHook(() => useSendCode({ send }))

    await act(async () => {
      await result.current.send('alice@example.com')
    })
    expect(result.current.remainingSeconds).toBe(60)

    act(() => result.current.reset())
    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()

    // reset 后可重新发码
    await act(async () => {
      await result.current.send('bob@example.com')
    })
    expect(send).toHaveBeenLastCalledWith('bob@example.com', 'REGISTER')
    expect(result.current.status).toBe('sent')
  })
})

describe('useSendCode — 图形码（手机分支）', () => {
  it('fetchCaptcha loads the captcha image (phone path)', async () => {
    const fetchCaptcha = vi
      .fn()
      .mockResolvedValue({ captchaId: 'cap-1', image: 'data:image/png;base64,AAA' })
    const { result } = renderHook(() =>
      useSendCode({ send: vi.fn(), sendSms: vi.fn(), fetchCaptcha }),
    )

    expect(result.current.captcha.image).toBeNull()
    expect(result.current.captcha.isLoading).toBe(false)

    await act(async () => {
      await result.current.fetchCaptcha()
    })

    expect(fetchCaptcha).toHaveBeenCalledTimes(1)
    expect(result.current.captcha.image).toBe('data:image/png;base64,AAA')
    expect(result.current.captcha.isLoading).toBe(false)
    expect(result.current.captcha.error).toBeNull()
  })

  it('phone send routes to sendSms with (phone, purpose, captchaId, captchaCode)', async () => {
    const sendSms = vi.fn().mockResolvedValue(OK)
    const fetchCaptcha = vi.fn().mockResolvedValue({ captchaId: 'cap-1', image: 'img' })
    const { result } = renderHook(() =>
      useSendCode({ send: vi.fn(), sendSms, fetchCaptcha }),
    )

    // 先取一张图形码（手机发码前置：判 phone 即取）
    await act(async () => {
      await result.current.fetchCaptcha()
    })

    await act(async () => {
      await result.current.send('13800138000', 'qa58')
    })

    expect(sendSms).toHaveBeenCalledWith('13800138000', 'REGISTER', 'cap-1', 'qa58')
    expect(result.current.status).toBe('sent')
  })

  it('phone send with CAPTCHA_INVALID (400) routes the error to the captcha field', async () => {
    const sendSms = vi.fn().mockRejectedValue(new SsoApiError('图形验证码错误', 400))
    const fetchCaptcha = vi.fn().mockResolvedValue({ captchaId: 'cap-1', image: 'img' })
    const { result } = renderHook(() =>
      useSendCode({ send: vi.fn(), sendSms, fetchCaptcha }),
    )

    await act(async () => {
      await result.current.fetchCaptcha()
    })
    await act(async () => {
      await result.current.send('13800138000', 'WRONG')
    })

    expect(result.current.captcha.error).toBe('图形验证码错误')
    // OTP 发码错误位保持干净（限流/网络才进 error）
    expect(result.current.error).toBeNull()
  })

  it('refetches a fresh captcha after every phone send attempt (one-time contract)', async () => {
    const sendSms = vi.fn().mockResolvedValue(OK)
    const fetchCaptcha = vi.fn().mockResolvedValue({ captchaId: 'cap-1', image: 'img' })
    const { result } = renderHook(() =>
      useSendCode({ send: vi.fn(), sendSms, fetchCaptcha }),
    )

    await act(async () => {
      await result.current.fetchCaptcha()
    })
    expect(fetchCaptcha).toHaveBeenCalledTimes(1)

    // 成功发码后自动重取（captcha 已被后端 verifyAndDelete 消费）
    await act(async () => {
      await result.current.send('13800138000', 'qa58')
    })
    expect(fetchCaptcha).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('sent')

    // 冷却到期前重发被忽略（不触发又一次重取）
    await act(async () => {
      await result.current.send('13800138000', 'qa58')
    })
    expect(fetchCaptcha).toHaveBeenCalledTimes(2)

    // 冷却到期后才可重发 → 用首次发码后自动重取的那张图形码，发码后又重取
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(result.current.remainingSeconds).toBe(0)

    await act(async () => {
      await result.current.send('13800138000', 'qa58')
    })
    expect(fetchCaptcha).toHaveBeenCalledTimes(3)
  })

  it('reset() clears the captcha (contact switches email↔phone)', async () => {
    const fetchCaptcha = vi.fn().mockResolvedValue({ captchaId: 'cap-1', image: 'img' })
    const { result } = renderHook(() =>
      useSendCode({ send: vi.fn(), sendSms: vi.fn(), fetchCaptcha }),
    )

    await act(async () => {
      await result.current.fetchCaptcha()
    })
    expect(result.current.captcha.image).toBe('img')

    act(() => result.current.reset())
    expect(result.current.captcha.image).toBeNull()
    expect(result.current.captcha.error).toBeNull()
  })

  it('phone send without a loaded captcha sets captchaError and does not get stuck sending', async () => {
    const sendSms = vi.fn().mockResolvedValue(OK)
    const fetchCaptcha = vi.fn().mockResolvedValue({ captchaId: 'cap-1', image: 'img' })
    const { result } = renderHook(() =>
      useSendCode({ send: vi.fn(), sendSms, fetchCaptcha }),
    )

    // 未先取图形码 → captchaId 缺失（UI 正常不会到这，此为兜底）
    await act(async () => {
      await result.current.send('13800138000', 'qa58')
    })

    expect(sendSms).not.toHaveBeenCalled()
    expect(result.current.captcha.error).toBe('请先获取图形验证码')
    // 关键：不卡在 'sending'（早返回在进入 'sending' 之前）
    expect(result.current.status).toBe('idle')
  })
})
