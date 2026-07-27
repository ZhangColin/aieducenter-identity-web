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
