import type { Metadata } from 'next'

import { AuthShell } from '@/components/auth-shell'
import { InvalidLinkNotice } from '@/components/invalid-link-notice'
import { parseAuthorizeParams, toURLSearchParams } from '@/lib/sso/authorize-params'

import { RegisterFlow } from './register-flow'

export const metadata: Metadata = {
  title: '注册 - 海创元智研云平台',
}

/** 薄组装：解析 searchParams（snake_case 透传参数）→ 有效进注册流程，无效显示错误态。 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const authorizeParams = parseAuthorizeParams(toURLSearchParams(await searchParams))

  return (
    <AuthShell>
      {authorizeParams ? <RegisterFlow authorizeParams={authorizeParams} /> : <InvalidLinkNotice />}
    </AuthShell>
  )
}
