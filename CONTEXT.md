# CONTEXT — aieducenter-identity-web

> 统一登录前端（应用层·平台自带应用）：identity 身份服务的唯一 UI（login.company.com）。登录 / 注册 / 社交登录 / MFA / 登出。
> 架构不变式见 CLAUDE.md「平台架构上下文」；本文件记录**本项目自己的**对接契约与设计演进。

## Language（术语表）

**图形验证码（Captcha）**：区分人机的**图片**校验题，**一次性**（校验即失效，不可复用）。与「动态验证码」是两个不同概念，不可混称「验证码」。
_Avoid_: 验证码（歧义）、图片码

**动态验证码（Verification Code / OTP）**：发送到邮箱或手机的**一次性数字码**，绑【目的】、有时效。注册/登录提交时凭它证明对该联络方式的持有。
_Avoid_: 验证码（歧义）、短信码/邮箱码

**目的（Purpose）**：动态验证码的绑定上下文（`REGISTER`/`LOGIN`/`RESET_PASSWORD`）；**跨目的不可复用**——注册码不能用于登录。
_Avoid_: 用途

**冷却（Cooldown）**：发码成功后对**同一联络方式**的重发锁定窗口；改联络方式即换桶、冷却重置。与【限流】不同：那是节流，这是成功后的自锁。
_Avoid_: 限流

**限流（Rate Limit）**：发码请求的节流策略（按联络方式或按 IP），触发返 429；前端把其响应时长当作冷却处理。
_Avoid_: 冷却

## 设计原则（用户定，2026-08-02）

1. **SSO 整体（含前后端）提供的能力，对应用对接越简单越好**——应用侧配置面 dev/prod 同构、只换 base URL；复杂泄漏给应用就会出问题。
2. **前后端职责明确；已实现的接口不是不能改**——需要后端改的直接提 issue，不在前端绕。

## Phase 1 范围（2026-08-02 拍板）

**做**：`/login`（密码登录）+ `/register`（email/phone + 密码，无验证码）+ client-info 品牌显示（「登录到 XXX 应用」）+ 登录/注册失败内联错误展示 + 本地联调拓扑打通（配 demo 跑首次登录/二次免登）。
**不做**（等后端）：短信验证码登录（identity #22）、社交登录（后端无端点，按钮不上）、MFA、忘记密码（依赖发码链路）、账号管理页（me/profile/改密）。

> identity-web 本期 = **纯无状态登录 UI**：不迁 studio-web 的 auth-store / token 存储 / useLogin hook，页面不持有会话态；唯一的"状态"是 URL 上的 authorize 透传参数。

## 对接契约（identity 后端现状 + 已定变更）

### 浏览器侧链路
```
业务应用 → GET /authorize?client_id&redirect_uri&state&nonce&scope
  ├─ 有 SSO cookie → 302 回 redirect_uri?code&state（二次免登）
  └─ 无 SSO cookie → 302 到 login-page-url?client_id&redirect_uri&state&nonce&scope（透传，snake_case）
登录页 → fetch POST /api/auth/login（JSON，同源经 Next rewrite；camelCase：clientId/redirectUri/state/nonce/scope/account/password）
  → 成功：200 {redirectUrl} + Set-Cookie(SSO 会话) → window.location 顶层导航回业务应用（#26 变更后）
  → 失败：{code,message}（凭据错 401 防枚举 / 停用 / 锁定）→ 内联展示，不刷新
注册页 → fetch POST /api/auth/register（同上 + email/phone 至少其一 + **emailCode/phoneCode 必填（ADR-0001 强制当场验码）** + password 必填）
  → 注册即登录（同 login 后半段）；错码 400 / 已注册 409 → 字段级内联（见下方陷阱）
注册页 → fetch POST /api/account/verification-code/email `{email,purpose:'REGISTER'}`（**ApiResponse 包装**端点）
  → 成功 `{code:200,message,data:{expireInSeconds,resentAfterSeconds}}` → 倒计时按 `resentAfterSeconds`（归一化为 cooldownSeconds）；429 限流体 `{code:429,message:"请60秒后再试"}` 无结构秒数
```

> ⚠️ **字段级错误映射契约陷阱（#10 落地时确认，读 identity 后端源码）**：注册错误体只带 `{code:<httpStatus>, message, data:null}`，**不含业务码字符串**——`ACCOUNT_007/008`、`VERIFICATION_CODE_INVALID/EXPIRED` 仅存在于后端枚举，`GlobalExceptionHandler` 经 `ApiResponse.error(codeMessage)` 序列化时只把 `httpStatus` 放进 `$.code`。故前端字段路由只能按 httpStatus（`registerErrorField`）：**409→contact**（注册唯一 409 = 邮箱/手机号已被使用）、**400 域错误（有 `message`、非 OIDC `{error}`）→code**（提交时联络方式已客户端校验，现实 400 即验码错/过期）、**400 OIDC/其余→顶部横幅**。**已知局限**：后端若新增其它 400 域错误（如密码强度不足、联络方式格式），也会被归到 code 字段——待后端在响应体暴露业务码字符串后细化（届时改 `registerErrorField` 按 code 路由，回归这两条测试）。业务码↔httpStatus 对照见 identity `AccountError`/`VerificationCodeError`。

> ⚠️ **契约冲突（2026-08-02 发现，#5 落地时）**：后端 #22 已落地，register 对提供的每个联络方式**强制当场验码**（缺码 400 CODE_INVALID）——与本期「无验证码」拍板冲突，无码提交在真实后端必 400。已提 [identity#28](https://github.com/ZhangColin/aieducenter-identity/issues/28) 待拍板（建议 dev 放行无码注册解锁联调）。#5 前端按原拍板实现（验证码元素隐藏），#6 注册链路验收前需 #28 有结论。

### 端点清单
| 端点 | 形态 | identity-web 用法 |
|---|---|---|
| `GET /authorize` | 302 状态机 | 不调（消费方入口） |
| `POST /api/auth/login` | JSON + form 双吃 | **fetch JSON**（form 变体 #23 不用） |
| `POST /api/auth/register` | JSON + form 双吃 | **fetch JSON** |
| `GET /api/auth/client-info?client_id=` | JSON 公开 | 登录/注册页查「登录到 XXX 应用」；只回 `{clientId, clientName}`（#24） |
| `GET /logout` | 302 | 不调（业务应用发起，#19） |
| `POST /api/account/verification-code/email` | JSON（**ApiResponse 包装**） | **注册发码（#10）**：`sendEmailCode(email,'REGISTER')`，`resentAfterSeconds→cooldownSeconds` 归一化；429 限流无结构秒数 |
| `GET /api/captcha` | JSON（**ApiResponse 包装**） | **注册手机发码（#11）**：`fetchCaptcha()` → `{captchaId, image(base64 data-url)}`；一次性，发短信时被后端 `verifyAndDelete` 消费 |
| `POST /api/account/verification-code/sms` | JSON（**ApiResponse 包装**） | **注册手机发码（#11）**：`sendSmsCode(phone,'REGISTER',captchaId,captchaCode)`；成功 `{expireInSeconds,resentAfterSeconds}`→归一化 cooldownSeconds；429 限流 / 400 CAPTCHA_INVALID·CAPTCHA_EXPIRED·手机号格式 |
| `POST /api/account/verify-code` | JSON | 本期不接（邮箱校验在后端 register 内联消费） |
| `POST /token` · `/userinfo` · `/jwks` · `/discovery` | 机机 | 不调（消费方 BFF 直连） |
| 短信登录 / 社交登录 / MFA | **未实现** | 后端尚无控制器 |

### 提交方式（2026-08-02 拍板）：同源 fetch + JSON，弃用 form 顶层提交
- **成功**：`200 {redirectUrl}`（Set-Cookie 种 SSO 会话）→ `window.location.href` 顶层导航——**跨站最后一跳仍是浏览器导航，「零跨域 fetch」不变式成立**（fetch 仅同源）。
- **失败**：内联展示，不刷新页面、表单字段保留。
- 后端配合：JSON 变体成功响应 `302` → `200 {redirectUrl}` → [identity#26](https://github.com/ZhangColin/aieducenter-identity/issues/26)。**本对接被它阻塞——落地前登录/注册提交无法联调。**（form 变体失败返裸 JSON 是已知缺陷，无人触发。）

## UI 设计来源与职责分离（2026-08-02 拍板）

- **视觉来源**：`aieducenter-studio-web/docs/stitch/平台登录-{浅色,深色}` + `平台注册-{浅色,深色}` 的 `code.html`——照它做，studio-web 的运行时代码（useLogin/auth-store/验证码逻辑）一律不看。
- stitch 栈 = Tailwind + `primary:#308ce8`（与本项目 tailwind.config 已一致）+ material-symbols 字体图标（**移植时换 lucide-react**）+ `darkMode:'class'`。
- **Phase 1 裁掉设计稿里后端未支持的元素**：手机验证码 tab、忘记密码、30天内免登录、微信/钉钉按钮——**整体隐藏**（不留 disabled 死按钮）；设计稿留着，后续阶段接回。
- 「登录到 XXX 应用」（client-info 的 clientName）放右侧卡片副标题区（「登录后继续前往 XXX」），不打乱左侧平台品牌。
- **职责分离铁律（用户定）**：UI 很可能改版，SSO 登录/注册逻辑稳定后基本不动——**SSO 流程逻辑（稳定层）与展示组件（易变层）必须分离开**，UI 改版不动 SSO 逻辑。

### 代码分层（接缝 = props/callbacks）
```
src/
├── app/login|register/page.tsx   # 薄：解析 searchParams → 组装 Screen
├── lib/sso/                      # ■ 稳定层（纯 TS，零样式）
│   ├── authorize-params.ts       #   URL query 解析/校验/序列化（login↔register 互跳携带）
│   ├── sso-api.ts                #   fetch 封装：clientInfo/login/register（带 emailCode）+ 契约类型 + 错误码→文案/字段（registerErrorField）
│   ├── verification-code.ts      #   发码：ApiResponse 解包 + sendEmailCode（归一化 resentAfterSeconds→cooldownSeconds）
│   ├── use-countdown.ts          #   倒计时原语（每秒递减、到 0 自停、卸载清理）
│   ├── use-send-code.ts          #   发码状态机：idle/sending/sent/error + 持有冷却（组合 useCountdown）+ reset（换联络方式换桶）
│   └── use-sso-flow.ts           #   提交流程状态机：idle→submitting→success(window.location)/error；SsoSubmitValues 含可选 code
└── components/                   # □ 易变层（纯展示，不识 URL/fetch）
    ├── auth-shell.tsx            #   左右分栏壳 + 品牌区 + footer
    ├── login-screen.tsx          #   props: {clientName,isLoading,error,onSubmit,onNavigateRegister}
    └── register-screen.tsx       #   props: {clientName,isLoading,error,sendCode,onSubmit(account,password,code),onNavigateLogin}；sendCode 为 useSendCode 的视图投影（SendCodeControl），字段级错误按 error.field 内联
```
- 流程状态用 React `useState` 收在 hook 内；**zustand 本期不引入**（单页单表单，无跨页状态）。
- client-info 在页面 `useEffect` fetch；失败降级为不显示应用名，不阻断登录。

## 本地/生产拓扑（2026-08-02 拍板）

**应用对接面（dev/prod 同构）**：应用唯一配置 = IdP base URL（dev `http://identity.localhost:10001` / prod `https://login.company.com`）。

**SSO 内部拼合**：
- dev：`/authorize` 无 cookie → 302 → `identity.localhost:10002/login`（identity 后端 local `login-page-url` 改一行，登录页落地后切）；identity-web fetch `/api/auth/*` 经 Next rewrite → `127.0.0.1:10001`（唯一一条 rewrite，修正现配置的错端口 8081）；SSO cookie host-only 跨端口共享；dev-login 兜底保留（identity-web 没起时后端+demo 照常）。
- prod：`login.company.com/` → identity-web 静态；`/authorize`·`/api/*`·`/token` → 后端（nginx 拼合）。

### 关键配置事实
- `identity.sso.login-page-url`：prod = `https://login.company.com/login`；local 现 = dev 一键登（#16）。
- SSO cookie：`httpOnly + Secure(可配) + SameSite=Lax + Path=/`，**无 Domain 属性**（host-only），值=不透明 sessionId。
- 本地 `.localhost` 多域联调：cookie 跨端口共享（host-only 按主机不按端口）。

## 验证与工作顺序（2026-08-02 拍板）

**端到端验证 = identity 仓现有 demo**（不新建、不另提 demo issue；要改就改它）。demo 是真实消费方（真 BFF/服务端换 token/登出按钮），之前唯一不真的地方是 IdP 侧 dev-login 兜底——那正是本项目要补的。注册流程经登录页「立即注册」链接进入，demo 零改动。

**验收 checklist**（四进程：identity + demo-backend + demo-web + identity-web）：
1. 首次登录：demo 点登录 → 落 `:10002/login` → `demo@aieducenter.com / demo12345` → 回 demo 显示用户
2. 二次免登：清 demo 业务 cookie 再登录 → 不出现登录页直接进
3. 注册：登录页点「立即注册」→ 新账号注册 → 注册即登录回 demo
4. 登出：demo 登出按钮 → 再登录需重新输密码
5. 错误态：错密码 → 内联报错不刷新；缺 client_id 直开 `/login` → 「登录链接无效」错误页

**自动化**：引入 vitest，**只测稳定层** `lib/sso/`（authorize-params / 错误映射 / sso-api mock fetch）；UI 层不测（要改版，分离原则的红利）。

**工作顺序**：① identity-web（rewrite 修正 + lib/sso + 页面 + 单测，对契约写不等后端）→ ② 后端 #26 → ③ 后端 #27 切 local login-page-url → ④ 四进程端到端 checklist。

## 决策记录

正式 ADR 见 `docs/adr/`；此处留轻量结论指针。

- 2026-08-02 Phase 1 范围 / 提交方式（fetch JSON 弃 form）/ 本地拓扑——本节上文三处「拍板」，源头是一次 grill-with-docs 会话。
- 2026-08-02 PRD 发布为本仓 [issue #3](https://github.com/ZhangColin/aieducenter-identity-web/issues/3)（`ready-for-agent`）；后端阻塞项 identity#26（契约）、identity#27（local 配置）。
- 2026-08-02 拆票（to-tickets，3 片 tracer bullet）：[#4 登录页全链路](https://github.com/ZhangColin/aieducenter-identity-web/issues/4)（无阻塞，先行）→ [#5 注册页+互跳](https://github.com/ZhangColin/aieducenter-identity-web/issues/5)（blocked by #4）→ [#6 四进程端到端验收](https://github.com/ZhangColin/aieducenter-identity-web/issues/6)（blocked by #4/#5 + identity#26/#27）。frontier = #4。
- 2026-08-02 #5 落地：稳定层扩 register（contact 归类 / register-form 校验 / sso-api register / use-sso-flow 注入 action / use-client-info 抽取）。发现后端 #22 已强制注册当场验码，与「本期无验证码」冲突 → 提 [identity#28](https://github.com/ZhangColin/aieducenter-identity/issues/28)（建议 dev 放行），并在 #6 登记阻塞。注册页裁剪元素：验证码、社交、服务协议勾选（协议文档未就位，footer 已有协议链接）。
- 2026-08-07 [identity#28](https://github.com/ZhangColin/aieducenter-identity/issues/28) **c-revised** 拍板落档为本仓 [ADR-0001](docs/adr/0001-register-requires-verification-code.md)：推翻 Phase 1「注册无验证码」，注册强制当场验码（码永远必填、不做缺码放行、无 dev/prod 分叉）。驱动 [#7 注册接码](https://github.com/ZhangColin/aieducenter-identity-web/issues/7)（本期）+ [#8 登录验证码登录](https://github.com/ZhangColin/aieducenter-identity-web/issues/8)（复用 #7 图形码组件与发码封装）。术语表新增：图形验证码 / 动态验证码 / 目的 / 冷却 / 限流。
- 2026-08-07 [#10 邮箱注册接码](https://github.com/ZhangColin/aieducenter-identity-web/issues/10)（#7 ②、#9 接缝之上）落地：稳定层新增 `verification-code.ts`（ApiResponse 解包 + sendEmailCode）/ `use-countdown.ts` / `use-send-code.ts`；register 带 `emailCode`、`registerErrorField` 按 httpStatus 字段路由；register-form 加 `code` 必填（不做格式门）；register-screen 加验证码输入 + 行内发码按钮（冷却倒计时、联络方式变更重置）。确认契约陷阱：注册错误体无业务码字符串 → 字段路由按 httpStatus（见上文「字段级错误映射契约陷阱」）。图形码 + 短信路径留 #8。
- 2026-08-07 [#11 手机注册接码](https://github.com/Zhangcolin/aieducenter-identity-web/issues/11)（#7 ③）落地：稳定层扩 `verification-code.ts`（`fetchCaptcha` / `sendSmsCode`）+ `use-send-code.ts` 手机分支（持有图形码态、一次性重取、429 武装冷却）；新增 `captcha-field` 纯展示组件；register-screen 判 phone 条件渲染图形码块（邮箱路径完全不出现）；register 手机分支带 `phoneCode`（#5 已就绪，零回归）。**图形码一次性生命周期**（后端 `verifyAndDelete` 在发短信内消费）：判 phone 即取 → 每次发 sms 尝试（成功/失败）后自动重取新 captchaId → 吃 `CAPTCHA_INVALID`/`CAPTCHA_EXPIRED`(400) 进图形码区 + 自动重取（保留错因文案）→ 保留点图刷新。**429 武装冷却决策（用户拍 A）**：register 页 email/phone 共用单 `useSendCode` 实例，429 一律武装冷却（email 同享，已更新 #10「429 不武装」那条刻意断言）；后端 429 体无结构化秒数，前端暂从 message 解析（`请60秒后再试`→60、无数字 fallback 60），已提 [identity#34](https://github.com/ZhangColin/aieducenter-identity/issues/34) 暴露结构化 `retryAfterSeconds` 后移除解析。`CAPTCHA_*` 进图形码区、`VERIFICATION_RATE_LIMIT_*`(429) 进发码按钮旁 + 武装冷却。
