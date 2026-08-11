import { afterEach, describe, expect, it, vi } from 'vitest'

import { SsoApiError } from './sso-api'
import { fetchCaptcha, sendEmailCode, sendSmsCode } from './verification-code'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendEmailCode', () => {
  it('posts {email,purpose} and unwraps the ApiResponse to normalized {expireInSeconds,cooldownSeconds}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        code: 200,
        message: 'Success',
        data: { expireInSeconds: 300, resentAfterSeconds: 60 },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmailCode('alice@example.com', 'REGISTER')

    // 后端 resentAfterSeconds 归一化为 cooldownSeconds，字段名不泄进 UI/类型
    expect(result).toEqual({ expireInSeconds: 300, cooldownSeconds: 60 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/account/verification-code/email')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ email: 'alice@example.com', purpose: 'REGISTER' })
  })

  it('falls back to the default cooldown when resentAfterSeconds is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          code: 200,
          message: 'Success',
          data: { expireInSeconds: 300 },
        }),
      ),
    )

    const result = await sendEmailCode('alice@example.com', 'REGISTER')

    // 成功体偶发缺 resentAfterSeconds → 回退默认 60s，杜绝 undefined 流入倒计时静默失效
    expect(result).toEqual({ expireInSeconds: 300, cooldownSeconds: 60 })
  })

  it('falls back to the default cooldown when resentAfterSeconds is non-numeric', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          code: 200,
          message: 'Success',
          data: { expireInSeconds: 300, resentAfterSeconds: 'later' },
        }),
      ),
    )

    const result = await sendEmailCode('alice@example.com', 'REGISTER')

    // 非数字同样回退默认，保证 cooldownSeconds 始终是有限正整数
    expect(result).toEqual({ expireInSeconds: 300, cooldownSeconds: 60 })
  })

  it('surfaces the backend message on rate limit (429) as an SsoApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 429, message: '请60秒后再试', data: null }, { status: 429 }),
      ),
    )

    const error = await sendEmailCode('alice@example.com', 'REGISTER').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('请60秒后再试')
    expect((error as SsoApiError).status).toBe(429)
  })

  it('surfaces the backend message on email-format errors (400)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 400, message: '邮箱格式不正确', data: null }, { status: 400 }),
      ),
    )

    const error = await sendEmailCode('not-an-email', 'REGISTER').catch((e: unknown) => e)

    expect((error as SsoApiError).message).toBe('邮箱格式不正确')
    expect((error as SsoApiError).status).toBe(400)
  })

  it('maps network failures to a network copy (no status)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const error = await sendEmailCode('alice@example.com', 'REGISTER').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('网络异常，请检查网络后重试')
    expect((error as SsoApiError).status).toBeUndefined()
  })

  it('falls back to a generic copy on unexpected statuses (e.g. 500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 500, message: 'Internal Server Error', data: null }, { status: 500 }),
      ),
    )

    const error = await sendEmailCode('alice@example.com', 'REGISTER').catch((e: unknown) => e)

    expect((error as SsoApiError).message).toBe('验证码发送失败，请稍后重试')
  })
})

describe('sendSmsCode', () => {
  it('posts {phone,purpose,captchaId,captchaCode} and unwraps the ApiResponse to normalized {expireInSeconds,cooldownSeconds}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        code: 200,
        message: 'Success',
        data: { expireInSeconds: 300, resentAfterSeconds: 60 },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendSmsCode('13800138000', 'REGISTER', 'captcha-id-1', 'qa58')

    // 与邮箱同源：resentAfterSeconds 归一化为 cooldownSeconds
    expect(result).toEqual({ expireInSeconds: 300, cooldownSeconds: 60 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/account/verification-code/sms')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({
      phone: '13800138000',
      purpose: 'REGISTER',
      captchaId: 'captcha-id-1',
      captchaCode: 'qa58',
    })
  })

  it('falls back to the default cooldown when resentAfterSeconds is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          code: 200,
          message: 'Success',
          data: { expireInSeconds: 300 },
        }),
      ),
    )

    const result = await sendSmsCode('13800138000', 'REGISTER', 'id', 'qa58')

    // 与邮箱同源归一化：缺字段回退默认 60s
    expect(result).toEqual({ expireInSeconds: 300, cooldownSeconds: 60 })
  })

  it('surfaces the backend message on rate limit (429) as an SsoApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 429, message: '请60秒后再试', data: null }, { status: 429 }),
      ),
    )

    const error = await sendSmsCode('13800138000', 'REGISTER', 'id', 'qa58').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('请60秒后再试')
    expect((error as SsoApiError).status).toBe(429)
  })

  it('surfaces the backend message on CAPTCHA_INVALID (400) as an SsoApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 400, message: '图形验证码错误', data: null }, { status: 400 }),
      ),
    )

    const error = await sendSmsCode('13800138000', 'REGISTER', 'id', 'WRONG').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('图形验证码错误')
    expect((error as SsoApiError).status).toBe(400)
  })

  it('maps network failures to a network copy (no status)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const error = await sendSmsCode('13800138000', 'REGISTER', 'id', 'qa58').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('网络异常，请检查网络后重试')
    expect((error as SsoApiError).status).toBeUndefined()
  })
})

describe('fetchCaptcha', () => {
  it('GETs /api/captcha and unwraps the ApiResponse to {captchaId,image}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        code: 200,
        message: 'Success',
        data: { image: 'data:image/png;base64,AAAA', captchaId: 'captcha-id-1' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchCaptcha()

    expect(result).toEqual({ captchaId: 'captcha-id-1', image: 'data:image/png;base64,AAAA' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/captcha')
    expect(init.method).toBe('GET')
  })

  it('maps network failures to a network copy (no status)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    const error = await fetchCaptcha().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('网络异常，请检查网络后重试')
    expect((error as SsoApiError).status).toBeUndefined()
  })

  it('falls back to a captcha-fetch copy on unexpected statuses (e.g. 500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ code: 500, message: 'Internal Server Error', data: null }, { status: 500 }),
      ),
    )

    const error = await fetchCaptcha().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SsoApiError)
    expect((error as SsoApiError).message).toBe('图形验证码获取失败，请刷新重试')
    expect((error as SsoApiError).status).toBe(500)
  })
})
