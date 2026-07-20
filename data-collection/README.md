# 种种 · 信息收集系统（data-collection）

Priority 1 MVP：六个信息采集模块共用统一 Schema，可提交、可存储、可对接前端。

## 技术栈

- Next.js (App Router) + TypeScript
- Supabase（Auth / Postgres / Storage）

## 你现在要做的（顺序）

1. **填环境变量**（现在就做）
2. **在 Supabase SQL Editor 跑 Schema**（现在就做）
3. **开 Auth 登录方式**（Schema 之后立刻做，RLS 依赖 `auth.uid()`）
4. 再写上传 / CRUD API，给前端 B 对接

> Windows 上 npm 版 Supabase CLI 暂不可用，本仓库用 `supabase/migrations/*.sql`，请在 Dashboard 手动执行。

## 1. 环境变量

```bash
cp .env.example .env.local
```

到 Supabase → **Project Settings → API** 填入：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key（可进浏览器） |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role（仅服务端，勿提交、勿加 NEXT_PUBLIC_） |
| `STAFF_REDEEM_PASSWORD` | 展位核销页 `/staff/redeem` 口令（仅服务端） |

`.env.local` 已被 gitignore，不会进仓库。

## 2. 执行 Schema

打开 Supabase → **SQL Editor**，按顺序粘贴并运行：

1. `supabase/migrations/20260718000000_init_info_collection.sql` — 六模块底座  
2. `supabase/migrations/20260719000000_field_conversion_layer.sql` — 现场转化层  
3. `supabase/migrations/20260719000001_fix_generated_pages_public_rls.sql` — 公开结果页 RLS（若 2 已含修复可跳过）  
4. `supabase/migrations/20260719000002_generated_pages_is_public.sql` — is_public 公开读（幂等）  
5. `supabase/migrations/20260720000000_redemption.sql` — 核销字段 redeemed_at / redeemed_by  

底座会创建：

- `templates`（六个预设模块）
- `profiles`（用户资料，注册自动创建）
- `entries`（统一采集主表）
- `entry_media` / `tags` / `entry_tags`
- RLS（本人可读写）
- Storage bucket `entry-images`

转化层额外：`entries` 活动字段、`entry_contacts`、`generated_pages`、AdventureX 三模板。  
字段契约见 [`docs/database-schema.md`](./docs/database-schema.md)。

> 若从零执行，跑完 1+2 即可；`000001` / `000002` 是远程迭代中的幂等补丁，重复执行安全。

## 3. Auth

Dashboard → **Authentication → Providers**，开启 **Email**，以及现场用的 **Anonymous**。

Authentication → **URL Configuration**：

- Site URL：`http://localhost:3000`
- Redirect URLs：`http://localhost:3000/auth/callback`

开发阶段建议关闭 **Confirm email**，否则注册后须点邮件才能登录。

## 本地运行

```bash
npm install
npm run dev
```

打开：

- `/signup` 注册
- `/login` 登录
- `/` 查看当前 user_id / profiles（未登录会跳到登录页）
- `/upload-test` 登录后上传图片到 Storage（验收用）
- `/entry-test` 登录后提交一条采集（极简验收；六个正式页归 B）

## 图片上传 + 采集提交（给前端 B）

```ts
import { uploadImage } from "@/lib/collection/upload-image";
import { createEntry, listEntries } from "@/lib/collection/create-entry";

const uploaded = await uploadImage(file);

const entry = await createEntry({
  template_slug: "plant", // place | plant | weather | animal | story | custom
  title: "路边的野花",
  description: "短描述",
  body: "正文",
  lat: 23.1,
  lng: 110.2,
  address: "某处",
  tags: ["春天", "路边"],
  media: [
    {
      storage_path: uploaded.storage_path,
      mime_type: uploaded.mime_type,
    },
  ],
});

const rows = await listEntries({ template_slug: "plant" });
```

- Bucket：`entry-images`（私有，≤10MB，jpeg/png/webp/gif）
- 路径第一段必须是当前用户 id（Storage RLS）
- `user_id` 由登录态自动带上，表单无需填写

## 目录

```
src/app/login|signup     # 极简登录注册（后端验收用）
src/app/upload-test      # 图片上传验收页
src/app/entry-test       # 采集提交验收页（非产品 UI）
src/app/auth/callback    # Auth 回调
src/middleware.ts        # 刷新 session + 未登录保护
src/lib/supabase/        # browser / server / admin / middleware
src/lib/collection/      # uploadImage / createEntry / listEntries
src/types/               # 给前后端共用的类型
supabase/migrations/     # Schema 源文件
```

## Git

当前在 `main` 开发（按你的要求）。需要远程时：

```bash
git remote add origin <your-repo-url>
git push -u origin main
```
