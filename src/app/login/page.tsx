import type { Metadata } from 'next'

import { AuthShell } from '@/components/auth-shell'
import { InvalidLinkNotice } from '@/components/invalid-link-notice'
import { parseAuthorizeParams } from '@/lib/sso/authorize-params'

import { LoginFlow } from './login-flow'

export const metadata: Metadata = {
  title: '登录 - 海创元智研云平台',
}

/** 薄组装：解析 searchParams（snake_case 透传参数）→ 有效进登录流程，无效显示错误态。 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const authorizeParams = parseAuthorizeParams(toURLSearchParams(await searchParams))

  return (
    <AuthShell>
      {authorizeParams ? <LoginFlow authorizeParams={authorizeParams} /> : <InvalidLinkNotice />}
    </AuthShell>
  )
}

function toURLSearchParams(record: Record<string, string | string[] | undefined>): URLSearchParams {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(record)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single !== undefined) query.set(key, single)
  }
  return query
}
