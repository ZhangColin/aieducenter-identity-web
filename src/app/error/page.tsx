import type { Metadata } from 'next'

import { AuthShell } from '@/components/auth-shell'
import { toURLSearchParams } from '@/lib/sso/authorize-params'

import { ErrorFlow } from './error-flow'

export const metadata: Metadata = {
  title: '出错了 - 海创元智研云平台',
}

/**
 * 薄组装：解析 searchParams（identity 后端 /authorize、/logout 出错 302 透传
 * error/error_description/client_id）→ ErrorFlow 套 AuthShell。
 * 仅 client_id 用于应用名解析；error/error_description 故意不透传给用户（项目原则：不泄漏 OIDC 细节）。
 * 作为独立目的地可用，不依赖前置导航状态。
 */
export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = toURLSearchParams(await searchParams)
  const clientId = query.get('client_id')?.trim() || undefined

  return (
    <AuthShell>
      <ErrorFlow clientId={clientId} />
    </AuthShell>
  )
}
