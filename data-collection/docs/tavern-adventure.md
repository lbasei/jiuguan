# 种种酒馆现场流程

酒馆入口和信息收集系统通过深链与同一 Supabase 项目连接：

1. 酒馆的“进入联名游园”打开 `/collect/tavern-park`，记录选择的摊位、角色或地点。
2. 游园页将选择暂存于当前浏览器，并进入 `/collect/tavern-promise`。
3. 承诺池将承诺、期限、重要程度、投入时间写入 `entries`，联系方式和授权写入 `entry_contacts`。
4. 浏览器使用当前匿名会话为该条承诺创建一个 `generated_pages` 记录，`share_slug` 即 ADV 创始体验码。
5. `/share/[shareSlug]` 显示现场小卡；工作人员在 `/staff/redeem` 输入该体验码后完成一次性核销。

## 上线前配置

1. 在 Supabase SQL Editor 按顺序执行既有 migrations，再执行 `20260720010000_tavern_adventure.sql`。
2. 在 Supabase Authentication 启用 Anonymous Sign-Ins；现场采集通过匿名会话受 RLS 保护。
3. 设置 data-collection 的 `NEXT_PUBLIC_TAVERN_ACCOUNT` 和 `NEXT_PUBLIC_TAVERN_CONTACT`，这两个值会公开显示在每一张小卡上。
4. 设置 jiuguan 的 `VITE_COLLECT_BASE_URL` 与 `VITE_TAVERN_BASE_URL` 为生产 URL。酒馆会把 `return_to` 参数传给信息收集系统，凭证页可回到酒馆。

## 隐私边界

- 微信与授权信息只写入 `entry_contacts`，不进入公开的 `generated_pages.render_data`。
- 凭证为持有即展示的现场码；其中仅包含游园点位、承诺和酒馆公开联系方式。
- 工作人员核销使用服务端 `SUPABASE_SERVICE_ROLE_KEY`，该密钥不会下发到浏览器。
