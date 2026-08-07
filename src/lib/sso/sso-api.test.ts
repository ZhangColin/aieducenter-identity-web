import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchClientInfo, login, register, SsoApiError } from './sso-api'

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

describe('register', () => {
  it('posts camelCase JSON with an email contact + emailCode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ redirectUrl: 'http://demo.localhost:3000/callback?code=abc&state=abc' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await register({
      ...authorizeParams,
      contact: 'new@aieducenter.com',
      code: '246810',
      password: 'secret123',
    })

    expect(result).toEqual({ redirectUrl: 'http://demo.localhost:3000/callback?code=abc&state=abc' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/register')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({
      clientId: 'demo',
      redirectUri: 'http://demo.localhost:3000/callback',
      state: 'abc',
      nonce: 'xyz',
      scope: 'openid profile',
      email: 'new@aieducenter.com',
      emailCode: '246810',
      password: 'secret123',
    })
  })

  it('classifies a phone contact to the phone field with phoneCode', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ redirectUrl: 'http://demo.localhost:3000/callback?code=abc' }))
    vi.stubGlobal('fetch', fetchMock)

    await register({
      ...authorizeParams,
      contact: '13800138000',
      code: '246810',
      password: 'secret123',
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toEqual({
      clientId: 'demo',
      redirectUri: 'http://demo.localhost:3000/callback',
      state: 'abc',
      nonce: 'xyz',
      scope: 'openid profile',
      phone: '13800138000',
      phoneCode: '246810',
      password: 'secret123',
    })
  })

  it('routes 409 (already registered) to the contact field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 409, message: '邮箱已被使用', data: null }, { status: 409 }),
      ),
    )

    const error = await register({
      ...authorizeParams,
      contact: 'a@b.c',
      code: '246810',
      password: 'x',
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('邮箱已被使用')
    expect((error as SsoApiError).status).toBe(409)
    expect((error as SsoApiError).field).toBe('contact')
  })

  it('routes 400 domain errors (wrong/expired code) to the code field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 400, message: '验证码错误', data: null }, { status: 400 }),
      ),
    )

    const error = await register({
      ...authorizeParams,
      contact: 'a@b.c',
      code: '000000',
      password: 'x',
    }).catch((e: unknown) => e)

    expect((error as SsoApiError).message).toBe('验证码错误')
    expect((error as SsoApiError).status).toBe(400)
    expect((error as SsoApiError).field).toBe('code')
  })

  it('routes ANY 400 domain error to the code field — known heuristic breadth (body has no business code)', async () => {
    // 契约陷阱（CONTEXT.md「字段级错误映射」）：注册错误体只带 {code:<httpStatus>, message}，
    // 无业务码字符串，故 400 域错误一律按 httpStatus 归 code。联络方式已由 parseContact 客户端预校验，
    // 现实中的 400 即验码错/过期；但后端若新增其它 400 域错误（如密码强度不足、联络方式格式），
    // 也会被归到 code 字段——已知局限，待后端在响应体暴露业务码后细化。
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 400, message: '手机号格式不正确', data: null }, { status: 400 }),
      ),
    )

    const error = await register({
      ...authorizeParams,
      contact: '13800138000',
      code: '246810',
      password: 'x',
    }).catch((e: unknown) => e)

    expect((error as SsoApiError).message).toBe('手机号格式不正确')
    expect((error as SsoApiError).field).toBe('code')
  })

  it('maps 400 in the OIDC shape (invalid client / redirect_uri) to the invalid-link banner (no field)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          { error: 'unauthorized_client', error_description: 'client_id 无效或未注册' },
          { status: 400 },
        ),
      ),
    )

    const error = await register({
      ...authorizeParams,
      contact: 'a@b.c',
      code: '246810',
      password: 'x',
    }).catch((e: unknown) => e)

    expect((error as SsoApiError).message).toBe('登录链接无效，请从应用进入')
    expect((error as SsoApiError).status).toBe(400)
    expect((error as SsoApiError).field).toBeUndefined()
  })

  it('maps network failures to a network copy (no status, no field)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const error = await register({
      ...authorizeParams,
      contact: 'a@b.c',
      code: '246810',
      password: 'x',
    }).catch((e: unknown) => e)

    expect((error as SsoApiError).message).toBe('网络异常，请检查网络后重试')
    expect((error as SsoApiError).status).toBeUndefined()
    expect((error as SsoApiError).field).toBeUndefined()
  })

  it('falls back to a generic register banner on unexpected statuses (e.g. 500, no field)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ code: 500, message: 'Internal Server Error' }, { status: 500 })),
    )

    const error = await register({
      ...authorizeParams,
      contact: 'a@b.c',
      code: '246810',
      password: 'x',
    }).catch((e: unknown) => e)

    expect((error as SsoApiError).message).toBe('注册失败，请稍后重试')
    expect((error as SsoApiError).field).toBeUndefined()
  })

  it('treats a 200 body without redirectUrl as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ unexpected: true })))

    const error = await register({
      ...authorizeParams,
      contact: 'a@b.c',
      code: '246810',
      password: 'x',
    }).catch((e: unknown) => e)

    expect((error as SsoApiError).message).toBe('注册失败，请稍后重试')
  })

  it('rejects an unclassifiable contact without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const error = await register({
      ...authorizeParams,
      contact: 'not-a-contact',
      code: '246810',
      password: 'x',
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('请输入正确的邮箱或手机号')
    expect(fetchMock).not.toHaveBeenCalled()
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
