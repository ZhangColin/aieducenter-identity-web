/**
 * /error 兜底页文案（identity 后端 /authorize、/logout 出错 302 跳来）。
 * 项目原则：不向用户原样透传 OIDC error/error_description，统一给友好引导文案。
 * clientName 解析成功 → 带应用名；缺失或解析失败 → 通用兜底。
 */
export interface ErrorNotice {
  title: string
  message: string
}

export function errorNotice(clientName?: string): ErrorNotice {
  if (clientName) {
    return { title: '出错了', message: `请回到「${clientName}」重新发起登录。` }
  }
  return { title: '应用信息异常', message: '请重新从应用进入登录。' }
}
