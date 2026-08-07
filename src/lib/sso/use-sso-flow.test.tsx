// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSsoFlow } from './use-sso-flow'
import { SsoApiError } from './sso-api'

const authorizeParams = {
  clientId: 'demo',
  redirectUri: 'http://demo.localhost:3000/callback',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useSsoFlow', () => {
  it('starts idle with no error', () => {
    const { result } = renderHook(() => useSsoFlow(authorizeParams))

    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  it('transitions idle → submitting → success and navigates to the redirectUrl', async () => {
    let resolveFetch!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve
          }),
      ),
    )
    const navigate = vi.fn()
    const { result } = renderHook(() => useSsoFlow(authorizeParams, { navigate }))

    let submitted!: Promise<void>
    act(() => {
      submitted = result.current.submit({ contact: 'demo@aieducenter.com', password: 'demo12345' })
    })
    expect(result.current.status).toBe('submitting')

    await act(async () => {
      resolveFetch(Response.json({ redirectUrl: 'http://demo.localhost:3000/callback?code=abc' }))
      await submitted
    })

    expect(result.current.status).toBe('success')
    expect(result.current.error).toBeNull()
    expect(navigate).toHaveBeenCalledWith('http://demo.localhost:3000/callback?code=abc')
  })

  it('transitions to error with the inline message on failure and does not navigate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 401, message: '账号或密码错误', data: null }, { status: 401 }),
      ),
    )
    const navigate = vi.fn()
    const { result } = renderHook(() => useSsoFlow(authorizeParams, { navigate }))

    await act(async () => {
      await result.current.submit({ contact: 'demo@aieducenter.com', password: 'wrong' })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeInstanceOf(SsoApiError)
    expect(result.current.error?.message).toBe('账号或密码错误')
    expect(result.current.error?.field).toBeUndefined()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('ignores a second submit while one is in flight', async () => {
    let resolveFetch!: (response: Response) => void
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSsoFlow(authorizeParams, { navigate: vi.fn() }))

    let first!: Promise<void>
    act(() => {
      first = result.current.submit({ contact: 'demo@aieducenter.com', password: 'demo12345' })
      void result.current.submit({ contact: 'demo@aieducenter.com', password: 'demo12345' })
    })
    await act(async () => {
      resolveFetch(Response.json({ redirectUrl: 'http://demo.localhost:3000/callback?code=abc' }))
      await first
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('can be resubmitted after an error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ code: 401, message: '账号或密码错误', data: null }, { status: 401 }),
      )
      .mockResolvedValueOnce(Response.json({ redirectUrl: 'http://demo.localhost:3000/callback?code=abc' }))
    vi.stubGlobal('fetch', fetchMock)
    const navigate = vi.fn()
    const { result } = renderHook(() => useSsoFlow(authorizeParams, { navigate }))

    await act(async () => {
      await result.current.submit({ contact: 'demo@aieducenter.com', password: 'wrong' })
    })
    expect(result.current.status).toBe('error')

    await act(async () => {
      await result.current.submit({ contact: 'demo@aieducenter.com', password: 'demo12345' })
    })

    expect(result.current.status).toBe('success')
    expect(result.current.error).toBeNull()
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('runs the injected action (register) instead of the default login', async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ redirectUrl: 'http://demo.localhost:3000/callback?code=abc' })
    const navigate = vi.fn()
    const { result } = renderHook(() => useSsoFlow(authorizeParams, { navigate, action }))

    await act(async () => {
      await result.current.submit({
        contact: 'new@aieducenter.com',
        code: '246810',
        password: 'secret123',
      })
    })

    // code 经值对象接缝透传到注册动作（注册强制当场验码，ADR-0001）
    expect(action).toHaveBeenCalledWith(authorizeParams, {
      contact: 'new@aieducenter.com',
      code: '246810',
      password: 'secret123',
    })
    expect(result.current.status).toBe('success')
    expect(navigate).toHaveBeenCalledWith('http://demo.localhost:3000/callback?code=abc')
  })

  it('surfaces the injected action’s error message inline', async () => {
    const action = vi.fn().mockRejectedValue(new SsoApiError('邮箱已被使用', 409))
    const navigate = vi.fn()
    const { result } = renderHook(() => useSsoFlow(authorizeParams, { navigate, action }))

    await act(async () => {
      await result.current.submit({ contact: 'a@b.c', password: 'x' })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error?.message).toBe('邮箱已被使用')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('falls back to a neutral copy when the action throws a non-Error', async () => {
    const action = vi.fn().mockRejectedValue('boom')
    const { result } = renderHook(() => useSsoFlow(authorizeParams, { navigate: vi.fn(), action }))

    await act(async () => {
      await result.current.submit({ contact: 'a@b.c', password: 'x' })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error?.message).toBe('操作失败，请稍后重试')
  })
})
