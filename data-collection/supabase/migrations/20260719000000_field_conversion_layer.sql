-- Incremental: AdventureX field conversion layer on top of info-collection MVP.
-- Does NOT drop or rebuild the six-module base tables.

-- ---------------------------------------------------------------------------
-- templates: version / render metadata
-- ---------------------------------------------------------------------------
alter table public.templates
  add column if not exists version int4 not null default 1,
  add column if not exists render_type text not null default 'form',
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'templates_render_type_check'
      and conrelid = 'public.templates'::regclass
  ) then
    alter table public.templates
      add constraint templates_render_type_check
      check (render_type in ('form', 'result-card', 'archive', 'route-record'));
  end if;
end $$;

drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- entries: campaign funnel fields (no share_slug — that lives on generated_pages)
-- ---------------------------------------------------------------------------
alter table public.entries
  add column if not exists source text,
  add column if not exists campaign text,
  add column if not exists status text not null default 'submitted',
  add column if not exists is_public boolean not null default false,
  add column if not exists submitted_at timestamptz,
  add column if not exists template_version int4 not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entries_status_check'
      and conrelid = 'public.entries'::regclass
  ) then
    alter table public.entries
      add constraint entries_status_check
      check (status in ('draft', 'submitted'));
  end if;
end $$;

-- Backfill existing rows as already submitted
update public.entries
set submitted_at = coalesce(submitted_at, collected_at, created_at)
where status = 'submitted' and submitted_at is null;

create index if not exists entries_source_idx on public.entries (source);
create index if not exists entries_campaign_idx on public.entries (campaign);
create index if not exists entries_status_idx on public.entries (status);

-- ---------------------------------------------------------------------------
-- entry_contacts: one row per entry (wechat and/or email + consents)
-- ---------------------------------------------------------------------------
create table if not exists public.entry_contacts (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique references public.entries (id) on delete cascade,
  wechat text,
  email text,
  join_beta boolean not null default false,
  allow_research boolean not null default false,
  allow_contact boolean not null default false,
  created_at timestamptz not null default now(),
  constraint entry_contacts_has_contact check (
    (wechat is not null and char_length(trim(wechat)) > 0)
    or (email is not null and char_length(trim(email)) > 0)
  )
);

create index if not exists entry_contacts_entry_id_idx
  on public.entry_contacts (entry_id);

-- ---------------------------------------------------------------------------
-- generated_pages: result HTML state (owned by 小吴 writers)
-- ---------------------------------------------------------------------------
create table if not exists public.generated_pages (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique references public.entries (id) on delete cascade,
  template_slug text not null,
  share_slug text not null,
  render_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  error_message text,
  -- Denormalized from entries.is_public for anon-safe public SELECT
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generated_pages_status_check
    check (status in ('pending', 'ready', 'failed')),
  constraint generated_pages_share_slug_not_empty
    check (char_length(trim(share_slug)) > 0)
);

create unique index if not exists generated_pages_share_slug_uidx
  on public.generated_pages (share_slug);

create index if not exists generated_pages_entry_id_idx
  on public.generated_pages (entry_id);

create index if not exists generated_pages_status_idx
  on public.generated_pages (status);

drop trigger if exists generated_pages_set_updated_at on public.generated_pages;
create trigger generated_pages_set_updated_at
  before update on public.generated_pages
  for each row execute function public.set_updated_at();

-- Copy entries.is_public onto generated_pages at insert; propagate on entry update
create or replace function public.generated_pages_sync_is_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(e.is_public, false) into new.is_public
  from public.entries e
  where e.id = new.entry_id;
  new.is_public := coalesce(new.is_public, false);
  return new;
end;
$$;

drop trigger if exists generated_pages_sync_is_public on public.generated_pages;
create trigger generated_pages_sync_is_public
  before insert on public.generated_pages
  for each row execute function public.generated_pages_sync_is_public();

create or replace function public.entries_propagate_is_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_public is distinct from old.is_public then
    update public.generated_pages
    set is_public = new.is_public
    where entry_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists entries_propagate_is_public on public.entries;
create trigger entries_propagate_is_public
  after update of is_public on public.entries
  for each row execute function public.entries_propagate_is_public();

revoke all on function public.generated_pages_sync_is_public() from public;
revoke all on function public.entries_propagate_is_public() from public;

-- ---------------------------------------------------------------------------
-- Seed AdventureX templates (keep existing six modules)
-- ---------------------------------------------------------------------------
insert into public.templates (
  slug, name, description, field_schema, is_system, version, render_type, is_active
) values
(
  'adventurex-profile',
  'AdventureX 角色档案',
  '现场扫码：身份 / 状态 / 目标 → 角色结果页',
  '[
    {"key":"nickname","label":"昵称","type":"text","required":true},
    {"key":"identity","label":"身份","type":"select","required":true,"options":["艺术创作者","开发者","产品/运营","学生","其他"]},
    {"key":"current_state","label":"当前状态","type":"select","required":true,"options":["正在冲刺","探索中","休息充电","寻找伙伴"]},
    {"key":"goal","label":"最近想完成的事","type":"text","required":true},
    {"key":"deadline","label":"完成周期","type":"select","required":true,"options":["今天","3days","1week","1month"]},
    {"key":"need_help","label":"是否需要帮助","type":"boolean","required":false}
  ]'::jsonb,
  true, 1, 'form', true
),
(
  'today-menu',
  '今日菜单',
  '现场：今日任务与阻碍',
  '[
    {"key":"task","label":"任务","type":"text","required":true},
    {"key":"eta","label":"预计时间","type":"text","required":false},
    {"key":"urgency","label":"紧急程度","type":"select","required":true,"options":["低","中","高"]},
    {"key":"blocker","label":"当前阻碍","type":"text","required":false},
    {"key":"need_help","label":"是否需要帮助","type":"boolean","required":false},
    {"key":"reward","label":"奖励","type":"text","required":false}
  ]'::jsonb,
  true, 1, 'form', true
),
(
  'booth-record',
  '展位记录',
  '现场：逛展记录与兴趣',
  '[
    {"key":"booths","label":"去过的展位","type":"text","required":false},
    {"key":"interest","label":"感兴趣的内容","type":"text","required":false},
    {"key":"done_tasks","label":"完成的任务","type":"text","required":false},
    {"key":"note","label":"现场记录","type":"textarea","required":false}
  ]'::jsonb,
  true, 1, 'form', true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  field_schema = excluded.field_schema,
  render_type = excluded.render_type,
  is_active = excluded.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- RLS: entry_contacts
-- ---------------------------------------------------------------------------
alter table public.entry_contacts enable row level security;

drop policy if exists "entry_contacts_select_own" on public.entry_contacts;
create policy "entry_contacts_select_own"
  on public.entry_contacts for select
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "entry_contacts_insert_own" on public.entry_contacts;
create policy "entry_contacts_insert_own"
  on public.entry_contacts for insert
  with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "entry_contacts_update_own" on public.entry_contacts;
create policy "entry_contacts_update_own"
  on public.entry_contacts for update
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "entry_contacts_delete_own" on public.entry_contacts;
create policy "entry_contacts_delete_own"
  on public.entry_contacts for delete
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: generated_pages
-- Owner can CRUD; anon can SELECT ready + public results only.
-- ---------------------------------------------------------------------------
alter table public.generated_pages enable row level security;

drop policy if exists "generated_pages_select_own" on public.generated_pages;
create policy "generated_pages_select_own"
  on public.generated_pages for select
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "generated_pages_select_public" on public.generated_pages;
create policy "generated_pages_select_public"
  on public.generated_pages for select
  using (status = 'ready' and is_public = true);

drop policy if exists "generated_pages_insert_own" on public.generated_pages;
create policy "generated_pages_insert_own"
  on public.generated_pages for insert
  with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "generated_pages_update_own" on public.generated_pages;
create policy "generated_pages_update_own"
  on public.generated_pages for update
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "generated_pages_delete_own" on public.generated_pages;
create policy "generated_pages_delete_own"
  on public.generated_pages for delete
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );
