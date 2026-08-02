import { describe, expect, it } from 'vitest'

import { parseAuthorizeParams, serializeAuthorizeParams } from './authorize-params'

describe('parseAuthorizeParams', () => {
  it('parses a full snake_case query into camelCase params', () => {
    const params = parseAuthorizeParams(
      'client_id=demo&redirect_uri=http%3A%2F%2Fdemo.localhost%3A3000%2Fcallback&state=abc&nonce=xyz&scope=openid+profile',
    )

    expect(params).toEqual({
      clientId: 'demo',
      redirectUri: 'http://demo.localhost:3000/callback',
      state: 'abc',
      nonce: 'xyz',
      scope: 'openid profile',
    })
  })

  it('returns null when client_id is missing', () => {
    expect(parseAuthorizeParams('redirect_uri=http%3A%2F%2Fdemo.localhost%2Fcallback')).toBeNull()
  })

  it('returns null when redirect_uri is missing', () => {
    expect(parseAuthorizeParams('client_id=demo')).toBeNull()
  })

  it('returns null when client_id is blank', () => {
    expect(
      parseAuthorizeParams('client_id=+&redirect_uri=http%3A%2F%2Fdemo.localhost%2Fcallback'),
    ).toBeNull()
  })

  it('returns null when redirect_uri is not an absolute http(s) URL', () => {
    expect(parseAuthorizeParams('client_id=demo&redirect_uri=not-a-url')).toBeNull()
    expect(
      parseAuthorizeParams('client_id=demo&redirect_uri=javascript%3Aalert%281%29'),
    ).toBeNull()
  })

  it('accepts a leading ? and URLSearchParams input', () => {
    const expected = {
      clientId: 'demo',
      redirectUri: 'http://demo.localhost:3000/callback',
    }

    expect(
      parseAuthorizeParams('?client_id=demo&redirect_uri=http%3A%2F%2Fdemo.localhost%3A3000%2Fcallback'),
    ).toEqual(expected)
    expect(
      parseAuthorizeParams(
        new URLSearchParams(
          'client_id=demo&redirect_uri=http%3A%2F%2Fdemo.localhost%3A3000%2Fcallback',
        ),
      ),
    ).toEqual(expected)
  })

  it('treats empty optional params as absent', () => {
    const params = parseAuthorizeParams(
      'client_id=demo&redirect_uri=http%3A%2F%2Fdemo.localhost%3A3000%2Fcallback&state=&scope=',
    )

    expect(params).toEqual({
      clientId: 'demo',
      redirectUri: 'http://demo.localhost:3000/callback',
    })
  })
})

describe('serializeAuthorizeParams', () => {
  it('serializes camelCase params into a snake_case query string', () => {
    const query = serializeAuthorizeParams({
      clientId: 'demo',
      redirectUri: 'http://demo.localhost:3000/callback',
      state: 'abc',
      nonce: 'xyz',
      scope: 'openid profile',
    })

    expect(query).toBe(
      'client_id=demo&redirect_uri=http%3A%2F%2Fdemo.localhost%3A3000%2Fcallback&state=abc&nonce=xyz&scope=openid+profile',
    )
  })

  it('omits absent optional params', () => {
    const query = serializeAuthorizeParams({
      clientId: 'demo',
      redirectUri: 'http://demo.localhost:3000/callback',
    })

    expect(query).toBe('client_id=demo&redirect_uri=http%3A%2F%2Fdemo.localhost%3A3000%2Fcallback')
  })

  it('round-trips with parse (snake ↔ camel)', () => {
    const params = {
      clientId: 'demo',
      redirectUri: 'http://demo.localhost:3000/callback?from=home',
      state: 'a+b c',
      nonce: 'xyz',
      scope: 'openid profile',
    }

    expect(parseAuthorizeParams(serializeAuthorizeParams(params))).toEqual(params)
  })

  it('preserves the full authorize context across a login ↔ register hop', () => {
    // 登录页 URL（/authorize 302 透传而来）→ 解析 → 序列化挂到 /register → 注册页再解析 → 完全一致
    const loginQuery =
      'client_id=demo&redirect_uri=http%3A%2F%2Fdemo.localhost%3A3000%2Fcallback&state=abc&nonce=xyz&scope=openid+profile'
    const params = parseAuthorizeParams(loginQuery)
    expect(params).not.toBeNull()

    const registerHref = `/register?${serializeAuthorizeParams(params!)}`
    const reparsed = parseAuthorizeParams(new URL(registerHref, 'http://localhost').search)

    expect(reparsed).toEqual(params)
    expect(registerHref).toContain('client_id=demo')
    expect(registerHref).toContain('state=abc')
    expect(registerHref).toContain('nonce=xyz')
    expect(registerHref).toContain('scope=openid+profile')
  })
})
