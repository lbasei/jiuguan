# 种种酒馆现场流程

酒馆入口和信息收集系统通过深链与同一 Supabase 项目连接。访客可以先走“今日酒单”引导，也可以继续进入联名游园：

1. 酒馆的“进入酒馆”先打开桂花引导页；“填写今日酒单”跳转到 `/collect/tavern-guide`。
2. 访客填写身份、当前状态、今天想做的事和可选卡点；内容写入 `entries`，可选微信与联系授权写入 `entry_contacts`。
3. 浏览器使用当前匿名会话创建一个 `generated_pages` 记录，`share_slug` 为 `MENU-...` 的今日特调现场凭证。
4. `/share/[shareSlug]` 显示今日特调、身份、目标、卡点和关键词；访客可向工作人员出示该页领取现场奖励。
5. 引导页的“进入联名游园”打开 `/collect/tavern-park`，展示酒鬼地图骨架：主题地标 + 可点摊位钉；点位数据来自 `adventure_partners`（含 zone / pin / booth_no），图片来自 `partner_media`。
6. 选中摊位后展示任务、奖励、官网与二维码；打卡写入 `entries.extra` 后进入 `/collect/tavern-promise`。承诺池写入承诺、期限、重要程度和投入时间后，生成 `ADV-...` 创始体验码，可在 `/staff/redeem` 完成一次性核销。

## AdventureX 今日特调规则

- `src/content/adventurex-specials.json` 保存状态选项、触发条件、特调名、关键词和反馈文案。
- `src/lib/collection/today-special-engine.ts` 只负责按顺序匹配规则并读取内容，不调用日常酒馆的 `nameDrink()` 动态调酒引擎。
- 匹配顺序为：卡点关键词、身份与状态组合、是否存在卡点、状态兜底、默认内容。
- 桂花是固定现场主持人；生成结果同时记录 `rule_id`、`content_key` 与 `content_version`，便于后续分析和更新文案。

## 上线前配置

1. 在 Supabase SQL Editor 按顺序执行既有 migrations，再执行 `20260720010000_tavern_adventure.sql` 与 `20260720020000_tavern_guide.sql`。
2. 在 Supabase Authentication 启用 Anonymous Sign-Ins；现场采集通过匿名会话受 RLS 保护。
3. 设置 data-collection 的 `NEXT_PUBLIC_TAVERN_ACCOUNT` 和 `NEXT_PUBLIC_TAVERN_CONTACT`，这两个值会公开显示在每一张小卡上。
4. 设置 jiuguan 的 `VITE_COLLECT_BASE_URL` 与 `VITE_TAVERN_BASE_URL` 为生产 URL。酒馆会把 `return_to` 参数传给信息收集系统，凭证页可回到酒馆。

## 隐私边界

- 微信与授权信息只写入 `entry_contacts`，不进入公开的 `generated_pages.render_data`。
- 今日特调凭证会公开展示身份、今天的目标与可选卡点，这是访客在提交前可见的现场展示内容；不要在这些字段填入敏感信息。
- 凭证为持有即展示的现场码；其中仅包含游园点位、承诺或今日特调，以及酒馆公开联系方式。
- 工作人员核销使用服务端 `SUPABASE_SERVICE_ROLE_KEY`，该密钥不会下发到浏览器。
