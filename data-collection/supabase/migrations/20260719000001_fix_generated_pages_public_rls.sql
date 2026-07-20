-- Applied after field_conversion_layer when public SELECT failed due to entries RLS.
-- Idempotent: same definition as the fix embedded in 20260719000000.

create or replace function public.is_public_entry(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.is_public from public.entries e where e.id = p_entry_id),
    false
  );
$$;

revoke all on function public.is_public_entry(uuid) from public;
grant execute on function public.is_public_entry(uuid) to anon, authenticated;

drop policy if exists "generated_pages_select_public" on public.generated_pages;
create policy "generated_pages_select_public"
  on public.generated_pages for select
  using (
    status = 'ready'
    and public.is_public_entry(entry_id)
  );
