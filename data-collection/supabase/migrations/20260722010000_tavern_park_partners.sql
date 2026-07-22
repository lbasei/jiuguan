-- AdventureX co-brand booth catalog: partners + media + public storage.
-- Check-ins still land in entries.extra with partner_id; this is the directory.

-- ---------------------------------------------------------------------------
-- adventure_partners
-- ---------------------------------------------------------------------------
create table if not exists public.adventure_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  intro text not null,
  keyword text not null,
  task text not null,
  reward text not null,
  website text,
  campaign text not null default 'adventurex-2026',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adventure_partners_name_not_empty check (char_length(trim(name)) > 0),
  constraint adventure_partners_slug_not_empty check (char_length(trim(slug)) > 0)
);

create index if not exists adventure_partners_campaign_active_idx
  on public.adventure_partners (campaign, is_active, sort_order);

drop trigger if exists adventure_partners_set_updated_at on public.adventure_partners;
create trigger adventure_partners_set_updated_at
  before update on public.adventure_partners
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- partner_media
-- ---------------------------------------------------------------------------
create table if not exists public.partner_media (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.adventure_partners (id) on delete cascade,
  kind text not null,
  storage_path text not null,
  public_url text,
  mime_type text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint partner_media_kind_check check (
    kind in ('logo', 'qr', 'booth', 'cover')
  ),
  constraint partner_media_storage_path_not_empty check (
    char_length(trim(storage_path)) > 0
  )
);

create index if not exists partner_media_partner_id_idx
  on public.partner_media (partner_id, kind, sort_order);

-- ---------------------------------------------------------------------------
-- RLS: public read for active catalog; writes via service role / dashboard
-- ---------------------------------------------------------------------------
alter table public.adventure_partners enable row level security;
alter table public.partner_media enable row level security;

drop policy if exists "adventure_partners_select_active" on public.adventure_partners;
create policy "adventure_partners_select_active"
  on public.adventure_partners for select
  using (is_active = true);

drop policy if exists "partner_media_select_public" on public.partner_media;
create policy "partner_media_select_public"
  on public.partner_media for select
  using (
    exists (
      select 1
      from public.adventure_partners p
      where p.id = partner_media.partner_id
        and p.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: partner-assets (public read)
-- Path convention: {campaign}/{slug}/{kind}-{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-assets',
  'partner-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "partner_assets_select_public" on storage.objects;
create policy "partner_assets_select_public"
  on storage.objects for select
  using (bucket_id = 'partner-assets');

-- Anon/authenticated clients do not write partner assets; use service role or Dashboard.

-- ---------------------------------------------------------------------------
-- Expand tavern-park field_schema for booth check-in extras
-- ---------------------------------------------------------------------------
update public.templates
set
  description = '选择一个联名摊位，完成小任务并记录线下游园印章。',
  field_schema = '[
    {"key":"park_stop","label":"游园点位","type":"select","required":true,"options":["联名摊位","角色角落","故事地标","承诺池"]},
    {"key":"partner_id","label":"摊位 ID","type":"text","required":false},
    {"key":"partner_slug","label":"摊位 slug","type":"text","required":false},
    {"key":"partner_name","label":"项目名称","type":"text","required":true},
    {"key":"keyword","label":"关键词","type":"text","required":false},
    {"key":"task","label":"小任务","type":"textarea","required":false},
    {"key":"reward","label":"奖励","type":"textarea","required":false},
    {"key":"website","label":"官网或二维码","type":"text","required":false},
    {"key":"note","label":"现场小记","type":"textarea","required":false}
  ]'::jsonb,
  version = greatest(coalesce(version, 1), 2),
  updated_at = now()
where slug = 'tavern-park';

-- ---------------------------------------------------------------------------
-- Seed partners from AdventureX 接龙 (text only; media uploaded separately)
-- ---------------------------------------------------------------------------
insert into public.adventure_partners (
  slug, name, intro, keyword, task, reward, website, campaign, sort_order, is_active
) values
(
  'squady',
  'Squady',
  'AI 原生社交，找回轻松有趣的古早互联网感觉',
  '社交',
  '试玩产品，并在产品内发布第一条 trace',
  '实体决策币，以及后续端内空投周边',
  'https://squady.app',
  'adventurex-2026', 10, true
),
(
  'narrio',
  'Narrio',
  'AI 原生设计产品，让审美平等流向每一个人',
  'Taste',
  '找主创聊聊品牌设计需求/卡点，完成调研问卷',
  '内测资格 / sticker / 光影钥匙扣等惊喜',
  'https://orlab.world',
  'adventurex-2026', 20, true
),
(
  'techflow',
  'TechFlow深潮',
  '全球新锐资产发现，洞察 AI、美股、Web3 与宏观',
  'Web3',
  '关注并下载深潮 APP',
  '鼠标垫 / 梗图 Sticker',
  'https://www.techflowpost.com/',
  'adventurex-2026', 30, true
),
(
  'toooony',
  'Toooony 车载 Circular AI Player',
  '面向开发者的定制车载硬件，适配与后端我们来搞定',
  '创作',
  '关注 Toooony 小红书',
  'R星 Sticker',
  null,
  'adventurex-2026', 40, true
),
(
  'lilac',
  'LILAC丁香谜',
  '泛谜题爱好者社区，因游戏产生真诚碰撞',
  '扩列',
  '来 Super! 展 65 号摊位写下联系方式/项目介绍/参展感受',
  '关注公众号/小红书获限定文创周边，先到先得',
  'https://bonjour.bio/yc-eagle',
  'adventurex-2026', 50, true
),
(
  'adg',
  '火山引擎ADG',
  '独立开发者社区，聚焦 Agent、MaaS 与 AI Infra',
  'AI Agent',
  '发活动图文到社交平台、关注公众号、扫码进杭州社群',
  'ADG 镭射袋/贴纸/短袖/帽子/杯子等',
  null,
  'adventurex-2026', 60, true
),
(
  'yixi',
  '一息',
  'AI 驱动定制香水与香薰，从气味描述到配方生成',
  'AI+气味',
  '体验一息 App 生成香水配方，关注小红书「一息 One Veyne」',
  '专属香水配方 NFC 气味卡片',
  null,
  'adventurex-2026', 70, true
),
(
  'soma',
  'Soma',
  '基于真实 Context，构建可纠正、可授权的人格 AI',
  'Personality',
  '加入微信内测群下载 Soma，构建 Self Agent 并对话一次',
  'Soma 小贴纸 + 山姆零食（限量）',
  'https://www.somaai.world',
  'adventurex-2026', 80, true
),
(
  'kitkit',
  'KitKit',
  'AI 拓扑协作平台，把聊天变成可生长的项目地图',
  'AI + 拓扑',
  '注册进社群参与大转盘，展位扫码发帖打卡',
  '大转盘周边 + Pro 限时体验 + 进群神秘大奖',
  'https://kitkit-agent.com/',
  'adventurex-2026', 90, true
)
on conflict (slug) do update set
  name = excluded.name,
  intro = excluded.intro,
  keyword = excluded.keyword,
  task = excluded.task,
  reward = excluded.reward,
  website = excluded.website,
  campaign = excluded.campaign,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
