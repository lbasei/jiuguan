-- Life Kitchen: email/password auth + cellar, friends, shares, events
-- Passwords live in auth.users; public schema holds app data only.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null default '无名旅人',
  display_name text,
  gender text not null default 'neutral'
    check (gender in ('male', 'female', 'neutral')),
  location_label text not null default '远方',
  coords jsonb,
  invite_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);
create index if not exists users_updated_at_idx on public.users (updated_at desc);

-- ---------------------------------------------------------------------------
-- Sessions (API bearer tokens)
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  token text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Invite codes
-- ---------------------------------------------------------------------------
create table if not exists public.invite_codes (
  code text primary key,
  label text not null default '',
  theme text not null default 'zhongzhong',
  max_uses int not null default 500,
  used_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.invite_codes (code, label, max_uses) values
  ('ZHONGZHONG', '种种内测券', 500),
  ('LIFE2026', 'Life Kitchen 邀请券', 500)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Drinks (cellar)
-- ---------------------------------------------------------------------------
create table if not exists public.drinks (
  id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  drink_name text not null,
  drink_date date,
  card jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now()
);

create index if not exists drinks_user_saved_idx on public.drinks (user_id, saved_at desc);
create index if not exists drinks_date_idx on public.drinks (drink_date desc);

-- ---------------------------------------------------------------------------
-- Friendships
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  friend_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists friendships_user_id_idx on public.friendships (user_id);
create index if not exists friendships_friend_id_idx on public.friendships (friend_id);

-- ---------------------------------------------------------------------------
-- Shares
-- ---------------------------------------------------------------------------
create table if not exists public.shares (
  id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  drink_id text not null references public.drinks (id) on delete cascade,
  visibility text not null default 'friends',
  created_at timestamptz not null default now()
);

create index if not exists shares_user_id_idx on public.shares (user_id);
create index if not exists shares_drink_id_idx on public.shares (drink_id);

-- ---------------------------------------------------------------------------
-- Events (analytics)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id text primary key,
  type text not null default 'click',
  label text not null default '',
  page text not null default '',
  user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_type_idx on public.events (type);

-- ---------------------------------------------------------------------------
-- RLS: enabled, no anon policies (API uses service role)
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.invite_codes enable row level security;
alter table public.drinks enable row level security;
alter table public.friendships enable row level security;
alter table public.shares enable row level security;
alter table public.events enable row level security;
