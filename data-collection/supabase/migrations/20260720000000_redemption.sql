-- Redemption fields on generated_pages (凭证 = share_slug).
-- Staff marks redeemed_at when a booth gift is handed out.

alter table public.generated_pages
  add column if not exists redeemed_at timestamptz,
  add column if not exists redeemed_by text;

create index if not exists generated_pages_redeemed_at_idx
  on public.generated_pages (redeemed_at);
