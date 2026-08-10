'use client'

import { ErrorScreen } from '@/components/error-screen'
import { errorNotice } from '@/lib/sso/error-notice'
import { useClientName } from '@/lib/sso/use-client-name'

/**
 * /error 兜底页客户端组装：解析应用名（缺失/任意失败降级 undefined）→ errorNotice 文案 → 纯展示 ErrorScreen。
 * error/error_description 由薄路由丢弃，不在此呈现。
 */
export function ErrorFlow({ clientId }: { clientId?: string }) {
  const clientName = useClientName(clientId)
  const { title, message } = errorNotice(clientName)

  return <ErrorScreen title={title} message={message} />
}
