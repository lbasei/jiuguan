# data-collection 数据库字段说明

给前端 / 小吴对接口用。增量建立在「六模块统一 entries」之上，**不推翻**原表。

## 设计约定（已拍板）

| 约定 | 说明 |
|------|------|
| `body` | 自由长文本 |
| `extra` | 仅 `field_schema` 结构化答卷 |
| 联系/授权 | 只写 `entry_contacts`，不进 `extra` |
| `share_slug` | 只在 `generated_pages`，不在 `entries` |
| `entries.status` | 仅 `draft` / `submitted` |
| 生成态 | 只看 `generated_pages.status` |
| 公开读 | anon 只能读 `ready` + `entries.is_public` 的 `generated_pages`（结果在 `render_data`） |

---

## 表一览

| 表 | 职责 |
|----|------|
| `templates` | 采集模板 + `field_schema` |
| `profiles` | 登录用户资料（1:1 auth.users） |
| `entries` | 一次填写的主记录 |
| `entry_contacts` | 选填联系方式 + 授权（每 entry 最多一行） |
| `generated_pages` | 结果页生成状态与可分享内容 |
| `entry_media` | 附件 |
| `tags` / `entry_tags` | 标签（系统公共标签后置） |

---

## `templates`

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✓ | uuid |
| `slug` | ✓ | unique，如 `adventurex-profile` |
| `name` | ✓ | 展示名 |
| `description` | | |
| `field_schema` | ✓ | jsonb 数组，定义表单题 |
| `is_system` | ✓ | 默认 true |
| `version` | ✓ | int，改题时 bump；写入 entry 时快照 |
| `render_type` | ✓ | `form` \| `result-card` \| `archive` \| `route-record` |
| `is_active` | ✓ | false 时不可新提交 |
| `created_at` / `updated_at` | ✓ | |

### 已种子模板

- `place` / `plant` / `weather` / `animal` / `story` / `custom`（原六模块）
- `adventurex-profile`（field_schema 已全）
- `today-menu` / `booth-record`（schema 已录入，可后续微调）

`adventurex-profile` 的 `field_schema` 题键：`nickname`, `identity`, `current_state`, `goal`, `deadline`, `need_help`。  
联系方式 / 内测 / 研究授权 **不在 schema 里**，走 `contact`。

---

## `entries`

| 字段 | 必填 | 可空 | 说明 |
|------|------|------|------|
| `id` | ✓ | | |
| `user_id` | ✓ | | auth 用户（含匿名） |
| `template_id` | ✓ | | → templates |
| `title` | ✓ | | 非空 |
| `description` | | ✓ | 短摘要 |
| `body` | | ✓ | 自由文本 |
| `lat` / `lng` / `address` | | ✓ | 地理 |
| `collected_at` | ✓ | | |
| `extra` | ✓ | | 默认 `{}`，结构化答卷 |
| `source` | | ✓ | `booth` / `poster` / `friend` / `partner` / `xiaohongshu` … |
| `campaign` | | ✓ | 如 `adventurex-2026` |
| `status` | ✓ | | **`draft` \| `submitted`** |
| `is_public` | ✓ | | 是否允许公开结果页 |
| `submitted_at` | | ✓ | status=submitted 时由 createEntry 写入 |
| `template_version` | ✓ | | 提交时快照 `templates.version` |
| `created_at` / `updated_at` | ✓ | | |

RLS：仅本人 CRUD。公开分享 **不** 靠开放整份 entry。

---

## `entry_contacts`

每条 entry **最多一行**。无联系方式则不插行。

| 字段 | 必填 | 可空 | 说明 |
|------|------|------|------|
| `id` | ✓ | | |
| `entry_id` | ✓ | | unique → entries |
| `wechat` | | ✓* | |
| `email` | | ✓* | |
| `join_beta` | ✓ | | 默认 false |
| `allow_research` | ✓ | | 默认 false |
| `allow_contact` | ✓ | | 默认 false |
| `created_at` | ✓ | | |

\* 约束：`wechat` 与 `email` **至少填一个**（trim 后非空）。

RLS：仅 entry 所有者。

---

## `generated_pages`

小吴写入主责。与 entry **1:1**（`entry_id` unique）。失败可 update 同一行重试。

| 字段 | 必填 | 可空 | 说明 |
|------|------|------|------|
| `id` | ✓ | | |
| `entry_id` | ✓ | | unique → entries |
| `template_slug` | ✓ | | 冗余便于查询 |
| `share_slug` | ✓ | | **全局 unique**，分享路径用 |
| `render_data` | ✓ | | 结果页自包含 JSON |
| `status` | ✓ | | `pending` \| `ready` \| `failed` |
| `error_message` | | ✓ | failed 时 |
| `is_public` | ✓ | | 插入时从 `entries.is_public` 同步；entry 更新会传播 |
| `redeemed_at` | | ✓ | **核销**：null=未兑；有值=已现场兑换 |
| `redeemed_by` | | ✓ | 可选，工作人员姓名/工位 |
| `created_at` / `updated_at` | ✓ | | |

### 核销约定

- **凭证号** = `share_slug`（不另建 `redeem_code`）
- 小吴生成结果时只写 `render_data` / `share_slug` / `status`，**不要写**核销字段
- 结果页应展示 `share_slug`，方便用户向工作人员出示
- 工作人员页：`/staff/redeem`（口令见 `STAFF_REDEEM_PASSWORD`），服务端用 service role 更新核销状态
- **务必执行** `20260720000000_redemption.sql`，写入 `redeemed_at` / `redeemed_by` 列
- 迁移未跑时，运行时会临时把核销信息写在 `render_data.__redeem`（`{ at, by }`）；迁移后自动改用正式列

### RLS

- 所有者：select / insert / update / delete
- **未登录**：仅 `status = 'ready' and is_public = true` 可读（不依赖 join `entries`，避免 RLS 挡住）

---

## 前端提交示例（createEntry）

```ts
await createEntry({
  template_slug: "adventurex-profile",
  title: "阿桂",
  source: "poster",
  campaign: "adventurex-2026",
  status: "submitted",
  is_public: true,
  extra: {
    nickname: "阿桂",
    identity: "艺术创作者",
    current_state: "正在冲刺",
    goal: "完成 AdventureX 现场版本",
    deadline: "3days",
    need_help: false,
  },
  contact: {
    wechat: "gui_wx",
    join_beta: true,
    allow_research: true,
    allow_contact: true,
  },
});
```

### 小吴结果页输入（建议）

```ts
type EntryResultInput = {
  entryId: string;
  templateSlug: string;
  title?: string;
  description?: string;
  body?: string;
  extra: Record<string, unknown>;
  // 生成后写入 generated_pages.render_data + share_slug + status=ready
};
```

公开页：`GET` by `share_slug` → 只依赖 `generated_pages.render_data`，不要把 `entry_contacts` 放进公开 payload。

---

## 状态机（简图）

```
用户填写
  → entries.status = submitted (+ submitted_at)
  → 可选 entry_contacts
  → （小吴）generated_pages.status = pending → ready | failed
分享链接只指向 ready 且 is_public 的 generated_pages
展位核销：工作人员用 share_slug → 写 redeemed_at（或迁移前的 render_data.__redeem）
```

## Migration 文件

1. `supabase/migrations/20260718000000_init_info_collection.sql` — 底座  
2. `supabase/migrations/20260719000000_field_conversion_layer.sql` — 转化层  
3. `supabase/migrations/20260719000001_fix_generated_pages_public_rls.sql` — 中间修复（已被 02 取代，幂等）  
4. `supabase/migrations/20260719000002_generated_pages_is_public.sql` — `generated_pages.is_public` 最终公开读方案  
5. `supabase/migrations/20260720000000_redemption.sql` — `redeemed_at` / `redeemed_by` 核销字段  
