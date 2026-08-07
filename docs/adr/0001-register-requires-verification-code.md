# 注册流程强制当场验码（推翻 Phase 1「无验证码注册」）

**状态**：accepted（2026-08-07 落档；源头决策 [identity#28](https://github.com/ZhangColin/aieducenter-identity/issues/28) **c-revised**，2026-08-02）

Phase 1（[#3](https://github.com/ZhangColin/aieducenter-identity-web/issues/3)）拍板注册「无验证码」、UI 裁掉验证码元素；但后端 identity#22 已落地，对注册提供的每个联络方式**强制当场验码**（缺码 400）。#5 落地时撞上该冲突——无码提交在真实后端必 400——提 identity#28 拍板。结论选 **c-revised**：identity-web 本期把验证码 UI 接全（email/phone + 图形码 + 密码必填），**码永远必填、不做缺码放行、无 dev/prod 行为分叉**。注册即此返工为 [#7](https://github.com/ZhangColin/aieducenter-identity-web/issues/7)。

## 考虑过的选项

- **a — dev 放行无码注册**：dev profile 跳过验码以解锁联调。否决：制造 dev/prod 行为分叉，dev 通的链路 prod 必坏。
- **b — 推迟到后端改**：等后端去掉强制验码。否决：验码是安全要求（证明对邮箱/手机的持有），不应为前端便利削安全。
- **c-revised（采纳）**：当期接全验证码 UI，契约「码永远必填」保持不变。

## 后果

- 推翻 Phase 1「注册无验证码」裁剪；#5 已合入的注册页/稳定层在 #7 返工补码——验证码字段是**从零构建**（非「取消隐藏」，代码里本就没有）。
- [#8](https://github.com/ZhangColin/aieducenter-identity-web/issues/8)（登录验证码登录）直接复用 #7 建成的图形码组件与发码封装，仅按【目的】=LOGIN 区分。
- 契约已稳定、零后端改动；dev 固定码（图形码 `qa58` / 动态码 `246810`，identity#29）是后端生成期注入，前端零关注。
- 契约陷阱（响应体 `ApiResponse` 包装与 register 裸体不对称、图形码一次性、冷却字段名 `resentAfterSeconds`、错码带前缀 `VERIFICATION_*`/`CAPTCHA_*`/`ACCOUNT_007/008`、purpose 跨上下文不可复用）见 CONTEXT.md 术语表与 `lib/sso/` 类型/测试。
