# 种种酒馆现场体验全链路

这是种种酒馆的完整现场体验代码仓库，包含两个独立应用：酒馆主体验与现场信息收集服务。二者通过 Supabase 与深链连接，支持“联名游园 → 承诺池 → ADV 创始体验码 → 现场小卡核销”的完整动线。

## 目录

| 目录 | 职责 | 默认端口 |
| --- | --- | --- |
| `tavern/` | Vite + React 酒馆主应用，现场入口与体验引导 | `5173` |
| `data-collection/` | Next.js + Supabase 采集、凭证与核销服务 | `3000` |

## 现场动线

1. 访问酒馆首页，选择 **Adventure**。
2. 点击“进入联名游园”，跳转到信息收集服务的数字地图。
3. 选择联名摊位、角色或地点，保存游园印章。
4. 在承诺池填写承诺、期限、重要程度、投入时间和微信。
5. 系统生成 `ADV-...` 创始体验码与现场小卡。
6. 工作人员在 `data-collection` 的 `/staff/redeem` 输入体验码，完成一次性核销。

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
```

最后一条迁移会创建或更新 `tavern-park` 与 `tavern-promise` 两个现场模板。

### 2. 开启认证方式

在 **Authentication → Providers** 中启用：

- Anonymous Sign-Ins：现场游客提交游园与承诺时需要。
- Email：如需使用注册/登录页时启用。

### 3. 配置信息收集服务

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

### 4. 配置酒馆服务

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

1. 访客在承诺池提交后会获得形如 `ADV-XXXX-XXXX-XXXX` 的体验码。
2. 工作人员打开 `http://localhost:3000/staff/redeem`。
3. 输入 `STAFF_REDEEM_PASSWORD`，粘贴体验码或整张凭证链接。
4. 先查询凭证，确认未核销后点击“确认核销并发放”。
5. 已核销凭证会显示核销时间，不能重复发放。

## 生产部署

两个应用可分别部署：

- `tavern/`：任意静态 Vite 托管平台。
- `data-collection/`：支持 Next.js 服务端运行的托管平台，例如 Vercel。

部署后，必须在酒馆端设置生产 `VITE_COLLECT_BASE_URL`，在信息收集端设置 `NEXT_PUBLIC_TAVERN_ACCOUNT` 与 `NEXT_PUBLIC_TAVERN_CONTACT`。重新构建酒馆端后，Adventure 深链会自动带上活动标识和返回酒馆地址。

## 验证

在提交或部署前，分别执行：

```bash
cd data-collection && npm run build
cd tavern && npm run build
```

现场验收至少覆盖：游园记录保存、承诺保存、体验码生成、凭证公开读取与工作人员核销。

## 安全约定

- 不提交 `.env.local`、Supabase service role key、短信/LLM/图像服务密钥或本地 `.data/`。
- 现场凭证是持有即展示的编码，只包含游园点位、承诺与酒馆公开联系方式；微信与授权信息仅保存于 `entry_contacts`。
- 如密钥曾出现在聊天、截图或提交记录中，应立即在 Supabase Dashboard 轮换。
