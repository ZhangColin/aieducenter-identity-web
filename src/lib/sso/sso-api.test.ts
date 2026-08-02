import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchClientInfo, login, SsoApiError } from './sso-api'

const authorizeParams = {
  clientId: 'demo',
  redirectUri: 'http://demo.localhost:3000/callback',
  state: 'abc',
  nonce: 'xyz',
  scope: 'openid profile',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('login', () => {
  it('posts camelCase JSON and resolves the redirectUrl on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ redirectUrl: 'http://demo.localhost:3000/callback?code=abc&state=abc' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await login({ ...authorizeParams, account: 'demo@aieducenter.com', password: 'demo12345' })

    expect(result).toEqual({ redirectUrl: 'http://demo.localhost:3000/callback?code=abc&state=abc' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({
      clientId: 'demo',
      redirectUri: 'http://demo.localhost:3000/callback',
      state: 'abc',
      nonce: 'xyz',
      scope: 'openid profile',
      account: 'demo@aieducenter.com',
      password: 'demo12345',
    })
  })

  it('adopts the backend message on 401 (wrong credentials / unknown account share one copy)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          { code: 401, message: '账号或密码错误', data: null },
          { status: 401 },
        ),
      ),
    )

    const error = await login({ ...authorizeParams, account: 'a@b.c', password: 'wrong' }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('账号或密码错误')
    expect((error as SsoApiError).status).toBe(401)
  })

  it('adopts the backend message on 401 for a disabled account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 401, message: '账号已停用', data: null }, { status: 401 }),
      ),
    )

    const error = await login({ ...authorizeParams, account: 'a@b.c', password: 'x' }).catch(
      (e: unknown) => e,
    )

    expect((error as SsoApiError).message).toBe('账号已停用')
  })

  it('adopts the backend message on 401 for a locked account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 401, message: '账号已锁定', data: null }, { status: 401 }),
      ),
    )

    const error = await login({ ...authorizeParams, account: 'a@b.c', password: 'x' }).catch(
      (e: unknown) => e,
    )

    expect((error as SsoApiError).message).toBe('账号已锁定')
  })

  it('maps 400 (invalid client / redirect_uri) to the invalid-link copy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          { error: 'unauthorized_client', error_description: 'client_id 无效或未注册' },
          { status: 400 },
        ),
      ),
    )

    const error = await login({ ...authorizeParams, account: 'a@b.c', password: 'x' }).catch(
      (e: unknown) => e,
    )

    expect((error as SsoApiError).message).toBe('登录链接无效，请从应用进入')
    expect((error as SsoApiError).status).toBe(400)
  })

  it('maps network failures to a network copy (no status)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const error = await login({ ...authorizeParams, account: 'a@b.c', password: 'x' }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('网络异常，请检查网络后重试')
    expect((error as SsoApiError).status).toBeUndefined()
  })

  it('falls back to a generic copy on unexpected statuses (e.g. 500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ code: 500, message: 'Internal Server Error' }, { status: 500 })),
    )

    const error = await login({ ...authorizeParams, account: 'a@b.c', password: 'x' }).catch(
      (e: unknown) => e,
    )

    expect((error as SsoApiError).message).toBe('登录失败，请稍后重试')
  })

  it('treats a 200 body without redirectUrl as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ unexpected: true })))

    const error = await login({ ...authorizeParams, account: 'a@b.c', password: 'x' }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('登录失败，请稍后重试')
  })
})

describe('fetchClientInfo', () => {
  it('gets client info with a snake_case query param', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ clientId: 'demo', clientName: 'Demo 应用' }))
    vi.stubGlobal('fetch', fetchMock)

    const info = await fetchClientInfo('demo')

    expect(info).toEqual({ clientId: 'demo', clientName: 'Demo 应用' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/client-info?client_id=demo')
  })

  it('rejects with status 400 when client_id is invalid (page shows invalid-link state)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          { error: 'unauthorized_client', error_description: 'client_id 无效或未注册' },
          { status: 400 },
        ),
      ),
    )

    const error = await fetchClientInfo('ghost').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).status).toBe(400)
  })

  it('rejects without status on network failure (page degrades silently)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const error = await fetchClientInfo('demo').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).status).toBeUndefined()
  })
})
