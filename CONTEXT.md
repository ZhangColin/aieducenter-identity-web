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

**冷却（Cooldown）**：发码成功后对**同一联络方式**的重发锁定窗口；只跟成功响应走、改联络方式即换桶重置。与【限流】不同：那是节流，这是成功后的自锁。
_Avoid_: 限流

**限流（Rate Limit）**：发码请求的节流策略（按联络方式或按 IP），触发返 429；后端兜底节流，前端不再据其武装冷却（429 仅展示文案）。
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
登录页（验证码登录 tab）→ fetch POST /api/auth/login-code（与 /login 同契约：account 单字段 + code 单字段，不拆 email/phone；authorize 透传）
  → 成功：200 {redirectUrl} + Set-Cookie → 顶层导航回业务应用
  → 失败：防枚举——错码与「账号不存在」后端同一 400 CODE_INVALID（同 status/message）→ 验证码字段内联同一文案；停用/锁定（401，验码通过后告知）/ OIDC / 网络 → 顶部横幅
注册页 → fetch POST /api/auth/register（同上 + email/phone 至少其一 + **emailCode/phoneCode 必填（ADR-0001 强制当场验码）** + password 必填）
  → 注册即登录（同 login 后半段）；错码 400 / 已注册 409 → 字段级内联（见下方陷阱）
注册页 → fetch POST /api/account/verification-code/email `{email,purpose:'REGISTER'}`（**ApiResponse 包装**端点）
  → 成功 `{code:200,message,data:{expireInSeconds,resentAfterSeconds}}` → 倒计时按 `resentAfterSeconds`（归一化为 cooldownSeconds，缺字段/非数字回退默认 60s）；429 限流体 `{code:429,message}` 仅展示文案、不武装冷却
```

> ⚠️ **字段级错误映射契约陷阱（#10 落地时确认，读 identity 后端源码）**：注册错误体只带 `{code:<httpStatus>, message, data:null}`，**不含业务码字符串**——`ACCOUNT_007/008`、`VERIFICATION_CODE_INVALID/EXPIRED` 仅存在于后端枚举，`GlobalExceptionHandler` 经 `ApiResponse.error(codeMessage)` 序列化时只把 `httpStatus` 放进 `$.code`。故前端字段路由只能按 httpStatus（`registerErrorField`）：**409→contact**（注册唯一 409 = 邮箱/手机号已被使用）、**400 域错误（有 `message`、非 OIDC `{error}`）→code**（提交时联络方式已客户端校验，现实 400 即验码错/过期）、**400 OIDC/其余→顶部横幅**。**已知局限**：后端若新增其它 400 域错误（如密码强度不足、联络方式格式），也会被归到 code 字段——待后端在响应体暴露业务码字符串后细化（届时改 `registerErrorField` 按 code 路由，回归这两条测试）。业务码↔httpStatus 对照见 identity `AccountError`/`VerificationCodeError`。

> ⚠️ **契约冲突（2026-08-02 发现，#5 落地时）**：后端 #22 已落地，register 对提供的每个联络方式**强制当场验码**（缺码 400 CODE_INVALID）——与本期「无验证码」拍板冲突，无码提交在真实后端必 400。已提 [identity#28](https://github.com/ZhangColin/aieducenter-identity/issues/28) 待拍板（建议 dev 放行无码注册解锁联调）。#5 前端按原拍板实现（验证码元素隐藏），#6 注册链路验收前需 #28 有结论。

### 端点清单
| 端点 | 形态 | identity-web 用法 |
|---|---|---|
| `GET /authorize` | 302 状态机 | 不调（消费方入口） |
| `POST /api/auth/login` | JSON + form 双吃 | **fetch JSON**（form 变体 #23 不用） |
| `POST /api/auth/login-code` | JSON + form 双吃 | **验证码登录（#8）fetch JSON**：`{...authorize, account, code}`（account 单字段、code 单字段，与 /login 同契约）；成功 200 {redirectUrl}；防枚举错码/账号不存在同一 400 CODE_INVALID → code 字段、停用/锁定 401 → 横幅 |
| `POST /api/auth/register` | JSON + form 双吃 | **fetch JSON** |
| `GET /api/auth/client-info?client_id=` | JSON 公开 | 登录/注册页查「登录到 XXX 应用」；只回 `{clientId, clientName}`（#24） |
| `GET /logout` | 302 | 不调（业务应用发起，#19） |
| `POST /api/account/verification-code/email` | JSON（**ApiResponse 包装**） | **注册发码（#10）**：`sendEmailCode(email,'REGISTER')`，`resentAfterSeconds→cooldownSeconds` 归一化；429 限流无结构秒数 |
| `GET /api/captcha` | JSON（**ApiResponse 包装**） | **注册手机发码（#11）**：`fetchCaptcha()` → `{captchaId, image(base64 data-url)}`；一次性，发短信时被后端 `verifyAndDelete` 消费 |
| `POST /api/account/verification-code/sms` | JSON（**ApiResponse 包装**） | **注册手机发码（#11）**：`sendSmsCode(phone,'REGISTER',captchaId,captchaCode)`；成功 `{expireInSeconds,resentAfterSeconds}`→归一化 cooldownSeconds；429 限流 / 400 CAPTCHA_INVALID·CAPTCHA_EXPIRED·手机号格式 |
| `POST /api/account/verify-code` | JSON | 本期不接（邮箱校验在后端 register 内联消费） |
| `POST /token` · `/userinfo` · `/jwks` · `/discovery` | 机机 | 不调（消费方 BFF 直连） |
| 社交登录 / MFA | **未实现** | 后端尚无控制器 |

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
├── app/login|register|error/page.tsx   # 薄：解析 searchParams → 组装 Screen
├── lib/sso/                      # ■ 稳定层（纯 TS，零样式）
│   ├── authorize-params.ts       #   URL query 解析/校验/序列化（login↔register 互跳携带）
│   ├── sso-api.ts                #   fetch 封装：clientInfo/login/login-code/register（带 emailCode）+ 契约类型 + 错误码→文案/字段（registerErrorField / loginCodeErrorField）
│   ├── verification-code.ts      #   发码：ApiResponse 解包 + sendEmailCode（归一化 resentAfterSeconds→cooldownSeconds）
│   ├── use-countdown.ts          #   倒计时原语（每秒递减、到 0 自停、卸载清理）
│   ├── use-send-code.ts          #   发码状态机：idle/sending/sent/error + 持有冷却（组合 useCountdown）+ reset（换联络方式换桶）
│   └── use-sso-flow.ts           #   提交流程状态机：idle→submitting→success(window.location)/error；SsoSubmitValues：contact 恒填 + 可选 code/password（密码登录/注册/验证码登录共用）
└── components/                   # □ 易变层（纯展示，不识 URL/fetch）
    ├── auth-shell.tsx            #   左右分栏壳 + 品牌区 + footer
    ├── login-screen.tsx          #   props: {clientName,mode,onModeChange,isLoading,error,onSubmit,sendCode,onCodeSubmit,onNavigateRegister}；tab 切换密码/验证码登录，账号字段跨方式共享，验证码登录复用 CaptchaField+useSendCode
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

**验收 checklist**（四进程：identity + demo-backend + demo-web + identity-web）——**Phase 1 收口（2026-08-10）**：
1. ✅ 首次登录：demo 点登录 → 落 `:10002/login` → `demo@aieducenter.com / demo12345` → 回 demo 显示用户〔2026-08-07 四进程实测〕
2. ✅ 二次免登：清 demo 业务 cookie 再登录 → 不出现登录页直接进〔实测：SSO 会话 host-only cookie 种下〕
3. ✅ 注册：登录页点「立即注册」→ 新账号注册 → 注册即登录回 demo〔2026-08-07 实测：新账号 userId 即时登入 demo〕
4. 登出：demo 登出按钮 → 再登录需重新输密码〔登出属 demo RP-initiated，identity-web 无登出 UI（见范围），验证步骤在兄弟仓 `docs/guide/local-sso-debugging.md` / identity#38〕
5. ✅ 错误态：错密码 → 内联报错不刷新；缺 client_id 直开 `/login` →「登录链接无效」错误页〔稳定层单测覆盖：401→防枚举文案、parseAuthorizeParams 缺 client_id→null→InvalidLinkNotice；手机注册错图形码已 e2e 实测〕

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

- 2026-08-07 #11 四进程 e2e（浏览器实测）：手机注册全链路绿——判 phone→图形码出现/加载、点图刷新换新 captchaId、错图形码→内联图形码区+自动重取、`qa58` 发码成功+冷却倒计时+一次性重取（OTP `246810` 落 Redis 实证）、register 带 phoneCode 返 `200`+发 code+种 SSO 会话（二次免登实证）。**e2e 暴露并修 #10 遗留 bug**：register-screen `handleSubmit` 调 `onSubmit(account, code, password)` 与 props 签名 `(account, password, code)` 第 2/3 参颠倒 → phoneCode/password 互换（后端 400「验证码错误」）；UI 层不测故单测未覆盖，e2e 才暴露，已修。**遗留（非 #11、非 identity-web）**：demo BFF 换 token `exchange_failed`——普通登录（demo@aieducenter.com）同样失败，是 demo / identity `/token` 端问题，阻塞验收 checklist「登录/注册即登录回 demo」最后一跳，已提 [identity#35](https://github.com/ZhangColin/aieducenter-identity/issues/35)。**已解决（2026-08-07）**：根因为 demo client 在 app-registry 的 `grants` 缺 `authorization_code`（/token 返 `unauthorized_client "client 未授权该 grant_type"`，非 identity-web / 非 demo-backend 换 token 逻辑）；identity 给 demo client 配上 grant 后，四进程 e2e 全绿——普通登录与手机注册即登录均回 demo 已登录（实测注册即登录：新账号 userId 即时登入 demo）。
- 2026-08-10 Phase 1 收口（[#6](https://github.com/ZhangColin/aieducenter-identity-web/issues/6) / [#3](https://github.com/ZhangColin/aieducenter-identity-web/issues/3)）：checklist 1-3 四进程真机实测通过、5 错误态稳定层单测覆盖 + 手机路径 e2e；登出（4）属 demo RP-initiated（identity-web 无登出 UI，见范围），验证步骤归兄弟仓 `local-sso-debugging.md` / identity#38。identity-web 侧 Phase 1 功能（登录 / 注册 / 邮箱+手机接码闭环 + 品牌显示 + 内联错误 + 二次免登）完成；[#8 登录验证码登录](https://github.com/ZhangColin/aieducenter-identity-web/issues/8) 为后续。
- 2026-08-10 [#12 /error 兜底路由](https://github.com/ZhangColin/aieducenter-identity-web/issues/12)（identity #39 前置 / ADR-0006 跳转目标）落地：identity 后端 `/authorize`、`/logout` 出错 302 跳此页。薄路由 `app/error/page.tsx` 解析 `?error&error_description&client_id`（仅取 `client_id`，error/error_description 在路由边界丢弃、不透传给用户）→ 客户端 `error-flow` → `ErrorScreen` 套 `AuthShell`（视觉参照 `InvalidLinkNotice`，圆形图标+标题+文案）。稳定层新增 `error-notice.ts`（文案决策：clientName 在→「请回到「X」重新发起登录」，缺失/失败→通用兜底）+ `use-client-name.ts`（**不复用 `useClientInfo`**——其 400→invalidLink 是登录页专用语义；错误页任意失败含 400/404/网络/5xx/空一律降级 undefined，页面照常渲染不崩）。**无可点外链**（BFF 选项 1，纯引导文案），可作独立目的地直达（不依赖前置导航状态）。稳定层单测覆盖（只测 `lib/sso/`）。
- 2026-08-10 [#8 登录页验证码登录](https://github.com/ZhangColin/aieducenter-identity-web/issues/8)（复用 #7 图形码组件 + 发码封装）落地：登录页加「验证码登录」tab，与密码登录并存切换；账号字段跨方式共享。**复用 #7 零重建**：`CaptchaField`（手机发码前置图形码）+ `useSendCode`（purpose=LOGIN，与注册 REGISTER 分键）原样复用，本票只换 purpose。**稳定层新增 `loginByCode()`**：`POST /api/auth/login-code` 与 `/login` 同契约——`{...authorize, account, code}` 单字段（后端按 `@` 区分邮箱/手机，前端不拆 email/phone，区别于 register），成功 200 {redirectUrl}。**错误映射 `loginCodeErrorField`**：防枚举核心——错码与「账号不存在」后端同一 400 CODE_INVALID（status/message 完全一致）→ 前端同归 `code` 字段同文案，不区分；停用/锁定（401，验码通过后告知）+ OIDC + 网络/5xx → 顶部横幅（不归属字段）。`SsoSubmitValues.password` 改可选（验证码登录无密码），login/register 动作 `?? ''` 类型桥接（真实路径恒有值，零行为变更）。**两登录方式各持独立 `useSsoFlow`**（密码=默认 login 动作 / 验证码=注入 loginByCode 动作），账号共享、状态互不串。密码登录 JSX 原样保留（回归无损）。稳定层单测覆盖 `loginByCode` 封装 + 错误映射 + 防枚举（10 例）；UI 层不测（分离原则）。e2e（四进程 + dev 固定码 qa58/246810）待验收 checklist。
- 2026-08-12 [#13 接码倒计时改用后端 `resentAfterSeconds`](https://github.com/ZhangColin/aieducenter-identity-web/issues/13)（[identity#34](https://github.com/ZhangColin/aieducenter-identity/issues/34) 契约固化后的收口）落地：**冷却只跟发码成功响应走**——用成功体 `resentAfterSeconds` 武装倒计时；归一化层新增 `normalizeCooldownSeconds`（缺字段/非数字/非正回退默认 60s，杜绝 `undefined`/`NaN` 流入倒计时静默失效，`cooldownSeconds` 契约强化为始终有限正整数）。**429 限流改为仅展示文案、不再武装冷却**（UI 冷却才是防刷主手段，429 只是后端兜底节流；多端首请求撞 429 走「通用文案、无倒计时」取舍），删除 `parseCooldownSeconds`（从 429 文案正则解析秒数的临时 hack）。零波及 `useCountdown` 原语与后端契约（identity#34 已结案，不在前端绕）；术语表【冷却】/【限流】+ 契约段同步更新。稳定层单测：归一化层补「缺字段（email+sms）/非数字（email）→ 默认冷却」、`useSendCode` 429 用例翻面（`remainingSeconds === 0`）。
