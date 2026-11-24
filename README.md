# 💰 设备摊销管家

> 每台设备每天花了你多少钱？一个开源免费的电子设备每日成本追踪工具。

买入一台设备后，「它每天的实际成本」会随着使用天数不断下降：

- 180 元买的小米手环，用了 2 年 → 每天只要 **¥0.25**
- 7,999 元的 MacBook 用了 3 年 → 每天 **¥7.29**
- 卖掉的旧手机回血 300 元 → 净花费立刻重新摊销

本工具帮你自动完成这一切计算。**本地优先（local-first）**：默认把数据存在你自己的浏览器里，不登录也能全功能使用；需要多设备同步时，再选配项目自带的后端。

> 🔗 **在线演示**：[device-amortization.app.workbuddy.host](https://device-amortization.app.workbuddy.host/?sharecode=RNZFOPBYVK)
> 演示站仅供体验，数据不保证长期保留，也请勿存放重要信息。

## ✨ 功能特性

- **📷 实物图片**：为每台设备上传实物照片，卡片以图片为主视觉；桌面端鼠标悬停显示完整信息遮罩，移动端则直接平铺重要信息
- **🛡 保修追踪**：记录保修时长（月），自动计算在保状态与剩余天数，临期高亮提醒；总览与卡片均可查看
- **🖼 分享卡片**：一键生成设备成本分享图（750×1000 PNG，含设备名/日均成本/已用天数），可保存转发
- **💳 设备分期追踪**：记录首付与分期期数（贷款本金自动 = 购买价 − 首付），自动推算月供、已还期数、剩余待还金额与还款进度，总览页汇总剩余负债
- **🏦 独立贷款管理**：房贷 / 车贷 / 购物分期单独成页。支持**等额本息、等额本金、先息后本、到期一次性还本付息**四种还款方式；**年利率 / 月利率 / 日利率（万分之）/ 总利息**四种口径；**每月 / 每季 / 每半年 / 每年 / 每两周**五种还款间隔。自动给出每月需还、累计已还、已付利息、剩余本金与完整还款计划表，并随日期自动推进
- **📉 实时摊销**：日均成本 = 净花费 ÷ 已使用天数，用得越久越便宜
- **⏱ 自动累加**：已使用天数每天零点自动 +1，页面开着也会自动刷新，无需手动维护
- **🗂 设备状态**：使用中 / 闲置 / 已出售（支持回血价）/ 已报废 / 已赠送，已结束的设备天数自动冻结
- **📊 汇总看板**：总投入、当前总日均成本（折合每月）、分类占比环形图、日均成本排行、🏆 最值/最贵设备
- **📈 成本曲线**：按月度采样的柱状图，直观展示成本逐月下降，并预测到预计年限末
- **🎯 预计年限与回本进度**：填写预计使用年限后显示回本进度条与目标日均成本
- **🏅 成就标签**：服役 1000+ 天、已用满预计年限、每天不到 1 元……
- **💾 数据安全**：本地写入失败不再静默（含容量告警与一键压缩照片）；存储告急时可导出完整 / 轻量两档 JSON 备份
- **📲 PWA**：可"添加到主屏幕"，全屏运行、独立图标，iOS Safari 与 Android Chrome 均支持
- **🔍 查找方便**：名称搜索、状态筛选、6 种排序方式
- **📱 响应式**：桌面与手机分别优化——桌面大图卡片 + 悬停信息，手机横向紧凑卡片，一屏可看更多

## 🛠 技术栈

- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4 + Radix UI**：基于 shadcn/ui 风格自建的组件库（Button / Input / Select / Dialog / Switch / Popover / Calendar / DatePicker），主题 tokens 通过 Tailwind `@theme` 统一管理
- 日期选择器：Radix Popover + react-day-picker（中文日历），全程无原生丑陋控件
- 图表零依赖：环形图用 CSS conic-gradient、成本曲线用手写 SVG
- 图标：自绘 1.6px 描边 SVG 线性图标集，无 emoji、无图标库
- 数据持久化：浏览器 localStorage（离线可用）；上传图片经 Canvas 压缩为 WebP（最长边 720px）后随记录保存

## 🚀 本地开发

```bash
npm install
npm run dev       # 启动开发服务器
npm run build     # 类型检查 + 构建生产版本（输出到 dist/）
npm run preview   # 本地预览生产构建
```

## 🌐 部署到 Cloudflare Pages（免费）

1. 将本项目推送到你的 GitHub 仓库
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择仓库并填写构建配置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 保存并部署，之后每次 `git push` 都会自动重新部署
5. （可选）绑定自定义域名，国内访问速度会更好

> 其他免费托管平台同理：Vercel、Netlify、GitHub Pages 均可直接使用（构建命令与输出目录相同）。

## ☁️ 云同步后端（可选）

项目内置了一个可选的同步后端（`server/` 目录），采用**本地优先（local-first）**架构：

- **不登录也能用**：所有数据默认存在浏览器本地，功能完整，不弹登录
- **登录后自动上云**：邮箱验证码登录（输入邮箱 → 收 6 位数字码 → 填入即登录），**无密码、无账号体系负担**
- **持久登录**：会话默认保持 180 天，登录一次长期无感
- **多端冲突保护**：乐观并发控制，其他设备有更新时提示选择保留哪份数据
- **技术栈**：Node.js + Hono + SQLite（better-sqlite3），单文件数据库零配置；会话与验证码均散列存储，验证码单次有效、限次防爆破
- **单端口部署**：后端顺带托管前端构建产物，一个进程一个端口即可跑完整应用

### 启动后端

```bash
cd server
npm install
npm run dev        # 开发模式：不发真邮件，验证码直接打印在服务端控制台
```

后端默认运行在 `http://localhost:8787`，数据库自动创建在 `server/data/app.db`。

### 登录方式：邮箱验证码

1. 前端输入邮箱 → 调 `POST /api/auth/request`
2. 服务端生成 6 位数字验证码（10 分钟有效、单次使用、最多输错 5 次），写入数据库并发送邮件
3. 前端填入验证码 → 调 `POST /api/auth/verify` → 换取 180 天会话

安全设计：验证码在库里存的是 `sha256(email + code)` 而非明文（混入邮箱使预计算表失效）；同一邮箱同时只有一条有效码，重新获取会立刻让旧码失效；请求侧 1 分钟 1 次 / 1 小时 10 次限流，校验侧 10 分钟 10 次限流。

### 邮件配置（三选一，都留空则进入演示模式）

未配置时进入**演示模式**：不发真邮件，验证码打印在服务端控制台，并在 `DEV_SHOW_CODE` 开启时随 API 返回、由前端直接显示（免收发邮件即可走通登录）。`DEV_SHOW_CODE` 默认在非生产环境为 `true`，`NODE_ENV=production` 时为 `false`。

> ⚠️ 演示模式 + 未配邮件 = 任何人只要知道邮箱就能登录。仅限自用调试，不要存放重要数据。

三种真实发信通道：

**方式一：SMTP（通用推荐）**——QQ 邮箱 / 163 / 企业邮箱均可：

```bash
# QQ 邮箱：设置 → 账户 → 开启「POP3/SMTP 服务」→ 获取授权码（填 SMTP_PASS，不是QQ密码）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=你的QQ邮箱@qq.com
SMTP_PASS=授权码
SMTP_FROM=设备摊销 <你的QQ邮箱@qq.com>
```

**方式二：QQ Agent Mail**（`xxx@agent.qq.com`，与个人邮箱隔离，免费 50 封/天）：

```bash
# 1. 微信扫码登录 https://agent.qq.com 创建邮箱地址
# 2. cd server && npm install（已内置 agently-cli 依赖）
# 3. 完成授权（浏览器打开输出链接）：
node node_modules/@tencent-qqmail/agently-cli/scripts/run.js auth login
# 4. .env 中开启：
AGENT_MAIL=true
```

**方式三：Resend**（海外服务，免费 100 封/天；未验证域名时只能发给注册邮箱）：配置 `RESEND_API_KEY` 与 `MAIL_FROM`。

### API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查（含 `mailConfigured` 标识是否配了发信通道） |
| POST | `/api/auth/request` | 请求登录验证码（`{ email }`，含限流） |
| POST | `/api/auth/verify` | 校验验证码换取会话（`{ email, code }`，单次有效） |
| GET | `/api/auth/me` | 当前用户信息 + 云端同步概要 |
| POST | `/api/auth/logout` | 注销当前会话 |
| GET | `/api/sync` | 拉取云端数据 |
| PUT | `/api/sync` | 上传数据（`{ data, baseUpdatedAt? }`，含乐观并发冲突检测） |

后端启动后可运行回归测试：`powershell -File server/test-api.ps1`（覆盖验证码登录 / 认证 / 同步 / 冲突 / 限流共 17 项）。

### ⚠️ 会话令牌为什么不用 `Authorization` 头

客户端携带会话令牌用的是自定义头 **`X-Session-Token`**，不是标准的 `Authorization: Bearer`。

原因：部分托管平台的入口网关会把 `Authorization` 头**替换成平台自己的身份 JWT**（实测 WorkBuddy 沙箱：客户端发来的 64 字符令牌，到服务端变成 386 字符的 `eyJhbGci…`），导致自己的会话凭证永远校验失败。换成自定义头即可原样穿透。

服务端两种取值都支持（`X-Session-Token` 优先，`Authorization: Bearer` 作为本地开发 / 通用反代的兼容回退），所以本地调试两种写法都能用。

## ☁️ 单端口部署（前后端一起）

`server` 会顺带托管前端构建产物（`STATIC_DIR`，默认 `../dist`），未命中文件时回落到 `index.html`。所以部署时只需要一个进程、一个端口：

```bash
npm install && npm --prefix server install   # 装依赖
npm run build                                # 构建前端到 dist/
npm --prefix server run start                # 启动，同时提供 API 与页面
```

访问 `http://localhost:8787` 即是完整应用。端口取 `PORT` 环境变量（默认 8787）。

> 只部署纯前端（不要云同步）也可以：`npm run build` 后把 `dist/` 丢到任意静态托管即可，登录入口会自动失效但本地功能完全可用。

## 📁 项目结构

```
server/                      # 云同步后端（Node.js + Hono + SQLite）
├── src/
│   ├── index.ts             # 服务入口（CORS / 限流 / 路由挂载 / 静态资源托管）
│   ├── env.ts               # 零依赖 .env 加载与配置
│   ├── db.ts                # SQLite 数据层（用户 / 会话 / 登录验证码 / 同步文档）
│   ├── auth.ts              # 会话鉴权中间件 + 令牌散列 + 验证码生成 + 内存限流
│   ├── mail.ts              # 登录验证码邮件（SMTP / Agent Mail / Resend / 演示模式）
│   └── routes/
│       ├── auth.ts          # 请求验证码 / 校验验证码 / 用户信息 / 注销
│       └── sync.ts          # 拉取 / 上传 / 冲突检测
└── test-api.ps1             # API 回归测试（16 项）

src/                         # 前端源码
├── main.tsx                 # 入口
├── App.tsx                  # 应用主组件：状态管理、页面切换、弹窗调度
├── index.css                # Tailwind 引入 + 设计 tokens（@theme）
├── types.ts                 # 类型定义（含贷款模型）
├── constants.ts             # 分类 / 状态 / 配色 / 存储键
├── lib/
│   └── utils.ts             # cn 类名合并工具
├── utils/
│   ├── calc.ts              # 设备摊销计算核心（纯函数）
│   ├── loanSchedule.ts      # 贷款利息引擎（四种还款方式 / 四种利率口径）
│   ├── date.ts              # 日期工具（本地时区安全）
│   ├── format.ts            # 金额 / 天数格式化
│   └── image.ts             # 图片压缩（Canvas → WebP）
├── data/
│   ├── storage.ts           # 设备 localStorage 读写、备份、数据校验
│   ├── loans.ts             # 贷款 localStorage 读写与校验
│   └── demo.ts              # 示例数据
├── hooks/
│   ├── useDevices.ts        # 设备列表状态（自动持久化）
│   ├── useLoans.ts          # 贷款列表状态（自动持久化）
│   ├── useSync.ts           # 云同步控制器（本地优先）
│   └── useToday.ts          # "今天"状态（跨日自动刷新全站）
└── components/
    ├── ui/                  # 组件库（shadcn 风格）
    │   ├── button.tsx
    │   ├── input.tsx
    │   ├── label.tsx
    │   ├── select.tsx       # Radix Select
    │   └── dialog.tsx       # Radix Dialog
    ├── Icon.tsx             # 自绘 SVG 图标集
    ├── Header.tsx           # 顶栏：云同步 / 添加设备
    ├── Dashboard.tsx        # 总览页
    ├── StatsGrid.tsx        # 统计卡
    ├── DonutChart.tsx       # 分类占比环形图
    ├── RankList.tsx         # 日均成本排行
    ├── Highlights.tsx       # 最值 / 最贵设备
    ├── DeviceList.tsx       # 设备列表页：搜索 / 筛选 / 排序
    ├── DeviceCard.tsx       # 设备卡片（桌面大图 / 手机横向紧凑）
    ├── CostBars.tsx         # 成本曲线（SVG 柱状图）
    ├── DeviceModal.tsx      # 添加 / 编辑设备弹窗
    ├── LoansDashboard.tsx   # 贷款页：汇总主卡 + 列表
    ├── LoanCard.tsx         # 贷款卡片（含可展开还款计划表）
    ├── LoanModal.tsx        # 添加 / 编辑贷款弹窗（含实时预览）
    ├── StorageBanner.tsx    # 本地存储告警与备份自救
    └── Toast.tsx            # 全局轻提示
```

## 📖 数据说明

- **未登录**时所有数据仅保存在浏览器本地（localStorage），不会上传到任何服务器
- **登录并开启云同步**后，数据会保存到你自己部署的后端数据库（SQLite），用于多设备同步
- 上传的设备图片会经 Canvas 压缩（最长边 720px、WebP）后与记录一同保存
- 清除浏览器数据或更换浏览器会丢失**本地**记录，请留意存储告警并及时备份
- 当本地存储接近上限时，页面会显示告警条，可导出完整 / 轻量两档 JSON 备份，或一键压缩已有照片释放空间

## 🖼 示例数据与素材来源

首次打开不会自动塞入示例数据。需要体验时，在「设备列表」空状态里点「载入示例数据」即可。示例覆盖全部 10 个品类与使用中 / 闲置 / 已出售 / 已报废四种状态，并带实物照片、分期、保修、预计年限等不同字段组合。

- 示例照片存放在 `public/demo/`，素材来自 [Pexels](https://www.pexels.com/)（免费商用、无需署名），已按 16:10 裁切为 960×600
- 载入时会先用 Canvas 压缩成 WebP dataURL（最长边 720px），与用户自己上传的照片走**完全相同**的处理链路，因此能正常参与备份与云同步
- 照片随构建产物发布，同源加载，不依赖外部图床；任何一张拉取失败只会让那张卡片退化成无图样式，不影响其余数据

## 📄 开源协议

本项目基于 [MIT License](./LICENSE) 开源，可自由使用、修改、分发与商用，保留版权声明即可。

## 🙏 致谢

- UI 灵感来自 shadcn/ui 的设计语言
- 示例照片来自 [Pexels](https://www.pexels.com/)
- 图表零依赖：环形图用 CSS `conic-gradient`，成本曲线为手写 SVG

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

[MIT](./LICENSE)
