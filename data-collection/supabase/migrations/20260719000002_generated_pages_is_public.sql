-- Prefer denormalized generated_pages.is_public for public SELECT (no RPC helper).

alter table public.generated_pages
  add column if not exists is_public boolean not null default false;

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

drop policy if exists "generated_pages_select_public" on public.generated_pages;
create policy "generated_pages_select_public"
  on public.generated_pages for select
  using (status = 'ready' and is_public = true);

drop function if exists public.is_public_entry(uuid);
