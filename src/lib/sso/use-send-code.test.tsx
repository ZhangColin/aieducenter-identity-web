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

  it('transitions to error with the message on failure (no cooldown started)', async () => {
    const send = vi.fn().mockRejectedValue(new SsoApiError('请60秒后再试', 429))
    const { result } = renderHook(() => useSendCode({ send }))

    await act(async () => {
      await result.current.send('alice@example.com')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('请60秒后再试')
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
