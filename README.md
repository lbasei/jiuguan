# 种种酒馆现场体验全链路

这是种种酒馆的完整现场体验代码仓库，包含两个独立应用：酒馆主体验与现场信息收集服务。二者通过 Supabase 与深链连接，支持“桂花引导 → 今日酒单 / 今日特调 → 联名游园 → 承诺池 → ADV 创始体验码 → 现场小卡核销”的完整动线。

## 目录

| 目录 | 职责 | 默认端口 |
| --- | --- | --- |
| `tavern/` | Vite + React 酒馆主应用，现场入口与体验引导 | `5173` |
| `data-collection/` | Next.js + Supabase 采集、凭证与核销服务 | `3000` |

## 现场动线

1. 访问酒馆首页：选择 **进入酒馆** 会进入桂花的现场引导页；选择 **Adventure** 会看到游园入口，并可进入独立的 Supabase 联名伙伴信息墙。
2. 点击“填写今日酒单”，跳转到 `/collect/tavern-guide`，填写身份、当前状态、今天想完成的事和可选卡点。
3. 系统把表单内容保存到 `entries`，把可选微信及联系授权单独保存到 `entry_contacts`，并生成 `MENU-...` 今日特调链接。
4. 访客在 `/share/MENU-...` 查看今日特调、关键词与完成提示，向工作人员出示该页领取现场奖励。
5. 在桂花引导页点击“进入联名游园”，跳转到信息收集服务的数字地图。
6. 选择联名摊位、角色或地点，保存游园印章；随后在承诺池填写承诺、期限、重要程度、投入时间和微信。
7. 系统生成 `ADV-...` 创始体验码与现场小卡。工作人员在 `data-collection` 的 `/staff/redeem` 输入体验码，完成一次性核销。

AdventureX 的今日特调使用简化规则引擎，不调用日常酒馆的 `nameDrink()`。触发条件与文案集中在 `data-collection/src/content/adventurex-specials.json`，规则解析位于 `data-collection/src/lib/collection/today-special-engine.ts`。桂花固定为现场主持人，特调名、关键词与反馈会根据身份、状态和卡点变化。

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- 一个 Supabase 项目

安装依赖时，分别在两个应用目录执行：

```bash
cd tavern
npm ci

cd ../data-collection
npm ci
```

## Supabase 初始化

### 1. 执行数据库迁移

打开 Supabase Dashboard 的 **SQL Editor**，按文件名顺序执行 `data-collection/supabase/migrations/` 下的 SQL：

```text
20260718000000_init_info_collection.sql
20260719000000_field_conversion_layer.sql
20260719000001_fix_generated_pages_public_rls.sql
20260719000002_generated_pages_is_public.sql
20260720000000_redemption.sql
20260720010000_tavern_adventure.sql
20260720020000_tavern_guide.sql
20260722010000_tavern_park_partners.sql
20260722020000_partner_map_pins.sql
```

后四条迁移会创建或更新 `tavern-park`、`tavern-promise` 与 `tavern-guide` 三个现场模板，并建立 `adventure_partners`、`partner_media`、地图点位及公开媒体 bucket。

### 2. 管理联名伙伴卡片

打开 Supabase **Table Editor → adventure_partners**。卡片的六个展示字段全部来自这张表：

| 页面内容 | 数据库字段 |
| --- | --- |
| 项目名称 | `name` |
| 项目简介 | `intro` |
| 关键词 | `keyword` |
| 现场任务 | `task` |
| 完成奖励 | `reward` |
| 官网或二维码地址 | `website` |

使用 `sort_order` 调整卡片顺序，使用 `is_active` 上下架，使用 `campaign` 区分活动。Advanced 页通过 `/api/adventure-partners` 动态读取数据，伙伴内容未写死在前端；修改后最多约 60 秒生效。Logo、二维码和展位图可继续维护在 `partner_media` 与 `partner-assets` bucket 中。

### 3. 开启认证方式

在 **Authentication → Providers** 中启用：

- Anonymous Sign-Ins：现场游客提交游园与承诺时需要。
- Email：如需使用注册/登录页时启用。

### 4. 配置信息收集服务

```bash
cd data-collection
cp .env.example .env.local
```

填写以下变量：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
STAFF_REDEEM_PASSWORD=CHANGE_THIS_FOR_THE_EVENT

# 会公开显示在现场小卡上，不要填个人隐私信息
NEXT_PUBLIC_TAVERN_ACCOUNT=种种酒馆
NEXT_PUBLIC_TAVERN_CONTACT=请在展位添加微信
```

`SUPABASE_SERVICE_ROLE_KEY` 只用于服务端核销逻辑，绝不能提交到 Git。

### 5. 配置酒馆服务

```bash
cd tavern
cp .env.local.example .env.local
```

本地联调：

```dotenv
VITE_COLLECT_BASE_URL=http://localhost:3000
VITE_TAVERN_BASE_URL=http://localhost:5173
VITE_ADVENTURE_CAMPAIGN=adventurex-2026
```

生产环境应改为两个实际部署域名，且不包含末尾 `/`：

```dotenv
VITE_COLLECT_BASE_URL=https://collect.example.com
VITE_TAVERN_BASE_URL=https://tavern.example.com
```

## 本地启动

打开两个终端。

```bash
cd data-collection
npm run dev
```

信息收集服务将运行于 `http://localhost:3000`。

```bash
cd tavern
npm run dev
```

酒馆服务将运行于 `http://localhost:5173`。

然后打开 `http://localhost:5173`，从首页的 Adventure 入口开始测试。

## 核销操作手册

1. 访客填写今日酒单后会获得形如 `MENU-XXXX-XXXX-XXXX` 的今日特调凭证，可直接出示给工作人员领取现场奖励。
2. 访客在承诺池提交后会获得形如 `ADV-XXXX-XXXX-XXXX` 的体验码。
3. 工作人员打开 `http://localhost:3000/staff/redeem`。
4. 输入 `STAFF_REDEEM_PASSWORD`，粘贴体验码或整张凭证链接。
5. 先查询凭证，确认未核销后点击“确认核销并发放”。
6. 已核销凭证会显示核销时间，不能重复发放。

## 生产部署

当前生产环境保留两个 Vercel 项目，但访客只使用一个统一入口：

- 统一入口：`https://lbasei-jiuguan.vercel.app`
- 自定义入口：`https://zhongzhongforever.net`（已加入 Vercel，需在域名 DNS 控制台完成 A 记录验证）
- 信息收集内部项目：`https://jiuguan-collect.vercel.app`

访客从统一入口访问酒馆。`tavern/vercel.json` 会把统一域名下的 `/api/adventure-partners`、`/collect/*`、`/share/*`、`/staff/*`、`/auth/*` 与 `/_next/*` 转发到信息收集项目，因此浏览器地址不会切换到第二个域名。工作人员使用 `https://lbasei-jiuguan.vercel.app/staff/redeem`。

酒馆项目的生产环境变量 `VITE_COLLECT_BASE_URL` 与 `VITE_TAVERN_BASE_URL` 都设置为 `same-origin`，因此 Vercel 默认域名和自定义域名会自动保持当前来源；信息收集项目保存 Supabase、核销口令与公开展示文案。服务端密钥只配置在 Vercel 环境变量中，不进入仓库。

当前未配置短信供应商，生产环境会禁用短信验证码登录并返回 `503`，桂花引导、Adventure、信息收集、结果分享与工作人员核销不受影响。启用日常酒馆登录前，需补充腾讯云短信或自有短信网关配置。

## 验证

在提交或部署前，分别执行：

```bash
cd data-collection && npm run build
cd tavern && npm run build
```

现场验收至少覆盖：桂花引导页、今日酒单保存、`MENU-...` 特调公开读取、游园记录保存、承诺保存、`ADV-...` 体验码生成与工作人员核销。

## 安全约定

- 不提交 `.env.local`、Supabase service role key、短信/LLM/图像服务密钥或本地 `.data/`。
- 现场凭证是持有即展示的编码。`MENU-...` 会展示身份、今日目标和可选卡点，`ADV-...` 会展示游园点位和承诺；微信与授权信息仅保存于 `entry_contacts`。
- 如密钥曾出现在聊天、截图或提交记录中，应立即在 Supabase Dashboard 轮换。
