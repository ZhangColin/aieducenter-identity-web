import { useEffect, useState } from 'react'

import { fetchClientInfo, SsoApiError } from './sso-api'

export interface ClientInfoState {
  /** 「登录/注册后继续前往 XXX」的应用名；查询失败为 undefined（降级不显示，不阻断流程）。 */
  clientName?: string
  /** client_id 无效（client-info 400）→ 页面切换为「登录链接无效」错误态。 */
  invalidLink: boolean
}

/** 登录/注册页共用的 client-info 品牌查询：400 → 链接无效；其余失败（网络/5xx）降级不阻断。 */
export function useClientInfo(clientId: string): ClientInfoState {
  const [clientName, setClientName] = useState<string>()
  const [invalidLink, setInvalidLink] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchClientInfo(clientId)
      .then((info) => {
        if (!cancelled) setClientName(info.clientName)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        // client_id 无效 = 链接无效；其余失败（网络/5xx）降级为不显示应用名，不阻断登录/注册
        if (e instanceof SsoApiError && e.status === 400) setInvalidLink(true)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  return { clientName, invalidLink }
}
