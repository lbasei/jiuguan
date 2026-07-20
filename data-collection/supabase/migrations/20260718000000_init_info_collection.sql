-- Info collection MVP: unified schema for 6 modules (+ future templates)
-- Run in Supabase Dashboard → SQL Editor (or via CLI when available)

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Templates (预设六个模块；以后可扩展自定义模板)
-- ---------------------------------------------------------------------------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  -- 预留：自定义字段定义，下一迭代模板机用
  field_schema jsonb not null default '[]'::jsonb,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.templates (slug, name, description) values
  ('place', '地方信息', '地点、场景与空间相关采集'),
  ('plant', '植物信息', '植物观察与记录'),
  ('weather', '天气信息', '天气与气候观察'),
  ('animal', '动物信息', '动物观察与记录'),
  ('story', '人物故事', '人物与故事采集'),
  ('custom', '自定义补充', '自由补充信息')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Entries (统一采集主表)
-- ---------------------------------------------------------------------------
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references public.templates (id),
  title text not null,
  description text,
  body text,
  lat double precision,
  lng double precision,
  address text,
  collected_at timestamptz not null default now(),
  -- 预留：模板扩展字段值
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entries_title_not_empty check (char_length(trim(title)) > 0),
  constraint entries_lat_range check (lat is null or (lat >= -90 and lat <= 90)),
  constraint entries_lng_range check (lng is null or (lng >= -180 and lng <= 180))
);

create index if not exists entries_user_id_idx on public.entries (user_id);
create index if not exists entries_template_id_idx on public.entries (template_id);
create index if not exists entries_collected_at_idx on public.entries (collected_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------
create table if not exists public.entry_media (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  public_url text,
  mime_type text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists entry_media_entry_id_idx on public.entry_media (entry_id);

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.entry_tags (
  entry_id uuid not null references public.entries (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (entry_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.templates enable row level security;
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.entry_media enable row level security;
alter table public.tags enable row level security;
alter table public.entry_tags enable row level security;

-- templates: 所有人可读（含未登录浏览模块列表）
drop policy if exists "templates_select_all" on public.templates;
create policy "templates_select_all"
  on public.templates for select
  using (true);

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- entries: 仅本人 CRUD
drop policy if exists "entries_select_own" on public.entries;
create policy "entries_select_own"
  on public.entries for select
  using (auth.uid() = user_id);

drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own"
  on public.entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "entries_update_own" on public.entries;
create policy "entries_update_own"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_delete_own"
  on public.entries for delete
  using (auth.uid() = user_id);

-- entry_media
drop policy if exists "entry_media_select_own" on public.entry_media;
create policy "entry_media_select_own"
  on public.entry_media for select
  using (auth.uid() = user_id);

drop policy if exists "entry_media_insert_own" on public.entry_media;
create policy "entry_media_insert_own"
  on public.entry_media for insert
  with check (auth.uid() = user_id);

drop policy if exists "entry_media_update_own" on public.entry_media;
create policy "entry_media_update_own"
  on public.entry_media for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "entry_media_delete_own" on public.entry_media;
create policy "entry_media_delete_own"
  on public.entry_media for delete
  using (auth.uid() = user_id);

-- tags
drop policy if exists "tags_select_own" on public.tags;
create policy "tags_select_own"
  on public.tags for select
  using (auth.uid() = user_id);

drop policy if exists "tags_insert_own" on public.tags;
create policy "tags_insert_own"
  on public.tags for insert
  with check (auth.uid() = user_id);

drop policy if exists "tags_update_own" on public.tags;
create policy "tags_update_own"
  on public.tags for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tags_delete_own" on public.tags;
create policy "tags_delete_own"
  on public.tags for delete
  using (auth.uid() = user_id);

-- entry_tags: 只能操作自己 entry 上的关联
drop policy if exists "entry_tags_select_own" on public.entry_tags;
create policy "entry_tags_select_own"
  on public.entry_tags for select
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "entry_tags_insert_own" on public.entry_tags;
create policy "entry_tags_insert_own"
  on public.entry_tags for insert
  with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "entry_tags_delete_own" on public.entry_tags;
create policy "entry_tags_delete_own"
  on public.entry_tags for delete
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket: entry-images
-- Path convention: {user_id}/{entry_id_or_temp}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'entry-images',
  'entry-images',
  false,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "entry_images_select_own" on storage.objects;
create policy "entry_images_select_own"
  on storage.objects for select
  using (
    bucket_id = 'entry-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "entry_images_insert_own" on storage.objects;
create policy "entry_images_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'entry-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "entry_images_update_own" on storage.objects;
create policy "entry_images_update_own"
  on storage.objects for update
  using (
    bucket_id = 'entry-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'entry-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "entry_images_delete_own" on storage.objects;
create policy "entry_images_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'entry-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
