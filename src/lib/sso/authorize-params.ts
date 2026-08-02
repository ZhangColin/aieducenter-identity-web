/**
 * authorize 透传参数：URL query 为 snake_case（/authorize 302 透传而来），
 * 内存与请求体为 camelCase。本模块负责两侧的解析/校验/序列化。
 */
export interface AuthorizeParams {
  clientId: string
  redirectUri: string
  state?: string
  nonce?: string
  scope?: string
}

export function parseAuthorizeParams(input: string | URLSearchParams): AuthorizeParams | null {
  const query = typeof input === 'string' ? new URLSearchParams(input) : input

  const clientId = query.get('client_id')
  const redirectUri = query.get('redirect_uri')
  if (!clientId?.trim() || !redirectUri || !isHttpUrl(redirectUri)) return null

  const params: AuthorizeParams = { clientId, redirectUri }
  const state = query.get('state')
  const nonce = query.get('nonce')
  const scope = query.get('scope')
  if (state) params.state = state
  if (nonce) params.nonce = nonce
  if (scope) params.scope = scope
  return params
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** 序列化为 snake_case query string（login↔register 互跳携带用）。 */
export function serializeAuthorizeParams(params: AuthorizeParams): string {
  const query = new URLSearchParams()
  query.set('client_id', params.clientId)
  query.set('redirect_uri', params.redirectUri)
  if (params.state) query.set('state', params.state)
  if (params.nonce) query.set('nonce', params.nonce)
  if (params.scope) query.set('scope', params.scope)
  return query.toString()
}

/** Next searchParams 记录（同名多值取首个）→ URLSearchParams，供 parseAuthorizeParams 消费。 */
export function toURLSearchParams(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(record)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single !== undefined) query.set(key, single)
  }
  return query
}
