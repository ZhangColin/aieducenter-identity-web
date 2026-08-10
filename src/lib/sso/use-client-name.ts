import { useEffect, useState } from 'react'

import { fetchClientInfo } from './sso-api'

/**
 * /error 兜底页应用名解析。
 * ⚠️ 与登录/注册页的 useClientInfo 不同：此处 client_id 缺失或解析失败（含 400）一律降级为 undefined，
 * 不切「链接无效」错误态——兜底页本身就是错误态，任意失败都走通用文案，页面照常渲染不崩。
 */
export function useClientName(clientId?: string): string | undefined {
  const [clientName, setClientName] = useState<string>()

  useEffect(() => {
    if (!clientId?.trim()) return
    let cancelled = false
    fetchClientInfo(clientId)
      .then((info) => {
        if (!cancelled) setClientName(info.clientName)
      })
      .catch(() => {
        /* 任意失败（400/404/网络/5xx/空）降级为 undefined，不阻断渲染 */
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  return clientName
}
