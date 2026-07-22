-- Life Kitchen: user habit profile + daily agent memories (text only, no voice)

-- ---------------------------------------------------------------------------
-- user_habits: one row per user, overwritten on each update
-- ---------------------------------------------------------------------------
create table if not exists public.user_habits (
  user_id uuid primary key references public.users (id) on delete cascade,
  priority_focus text not null default 'rhythm'
    check (priority_focus in ('task_preference', 'communication_style', 'rhythm')),
  habit_summary text not null default '',
  preferences text not null default '',
  avoidances text not null default '',
  rhythm_profile jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  source_tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_habits_updated_at_idx
  on public.user_habits (updated_at desc);

-- ---------------------------------------------------------------------------
-- agent_memories: daily summaries + profile snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.agent_memories (
  id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  memory_date date not null,
  memory_type text not null default 'daily_review'
    check (memory_type in ('daily_review', 'profile_snapshot')),
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, memory_date, memory_type)
);

create index if not exists agent_memories_user_date_idx
  on public.agent_memories (user_id, memory_date desc);

create index if not exists agent_memories_created_at_idx
  on public.agent_memories (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: enabled, no anon policies (API uses service role)
-- ---------------------------------------------------------------------------
alter table public.user_habits enable row level security;
alter table public.agent_memories enable row level security;
