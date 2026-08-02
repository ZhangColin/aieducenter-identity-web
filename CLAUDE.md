# aieducenter-identity-web

前端项目，基于 Next.js。

## 技术栈

- Next.js 15（App Router）/ React 19 / TypeScript（strict）
- Tailwind CSS / Zustand / pnpm
- 路径别名：`@/*` → `./src/*`，工具函数：`@/lib/utils`（cn）

## 常用命令

- 开发：`pnpm dev`（端口 10002）
- 构建：`pnpm build`
- 代码检查：`pnpm lint`
- 类型检查：`pnpm typecheck`

## 编码规范

- 函数组件 + hooks，禁止 class 组件
- 状态管理：Zustand store，放 `src/lib/store/`
- 样式：Tailwind CSS，用 `cn()` 合并类名
- API 调用：通过 Next.js rewrite 代理 `/api/*` → 后端，前端直接 fetch

## Agent skills

### Issue tracker

Issues live in GitHub Issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, label string equal to each role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.


## 平台架构上下文
本应用（identity-web）是统一登录前端（应用层·平台自带应用），身份服务的唯一 UI（login.company.com）：登录 / 注册 / 社交登录 / MFA / 登出。完整架构与决策在兄弟仓库 ../aieducenter-architecture/（起步包 docs/starters/identity-web.md）。

稳定不变式（务必遵守）：
- 只服务 Account 域的 SSO；Operator 不走这（operator 在统一后台本地登录）。
- BFF 模式：token 只存服务端（应用后端换 token），浏览器只持 httpOnly + SameSite(Lax) cookie，永不接触 token。
- redirect_uri 预注册 + 严格校验；state 防 CSRF、nonce 防重放；登录完按 return_to 回前端页。
- 底下调 identity 后端：/authorize（浏览器侧跳转）+ /token（BFF 服务端换）。
- 不做账号管理 / 资料编辑（那是各应用或统一后台）——只做登录闭环 + BFF 换 token。

深度（统一登录架构、前后端分离部署、SSO 时序）：读架构仓库 architecture.md §6.1 ⑥⑦、integration-flows.md §1、map.md（对接文档要求）。
本项目自己的设计演进 → 本项目的 CONTEXT.md + docs/adr/。