-- Map pins for 酒鬼地图 skeleton: zone + percentage coordinates on the park board.

alter table public.adventure_partners
  add column if not exists zone text,
  add column if not exists pin_x numeric(5,2),
  add column if not exists pin_y numeric(5,2),
  add column if not exists booth_no text;

alter table public.adventure_partners
  drop constraint if exists adventure_partners_pin_x_range;
alter table public.adventure_partners
  add constraint adventure_partners_pin_x_range
  check (pin_x is null or (pin_x >= 0 and pin_x <= 100));

alter table public.adventure_partners
  drop constraint if exists adventure_partners_pin_y_range;
alter table public.adventure_partners
  add constraint adventure_partners_pin_y_range
  check (pin_y is null or (pin_y >= 0 and pin_y <= 100));

alter table public.adventure_partners
  drop constraint if exists adventure_partners_zone_check;
alter table public.adventure_partners
  add constraint adventure_partners_zone_check
  check (
    zone is null or zone in (
      'ai_lab',
      'knowledge_tree',
      'tavern',
      'creative',
      'amusement',
      'onchain',
      'friendship'
    )
  );

-- Place partners on the adventure-world map (percent of board width/height).
update public.adventure_partners set
  zone = 'friendship', pin_x = 42, pin_y = 86, booth_no = null, updated_at = now()
where slug = 'squady';

update public.adventure_partners set
  zone = 'creative', pin_x = 76, pin_y = 44, booth_no = null, updated_at = now()
where slug = 'narrio';

update public.adventure_partners set
  zone = 'onchain', pin_x = 74, pin_y = 70, booth_no = null, updated_at = now()
where slug = 'techflow';

update public.adventure_partners set
  zone = 'creative', pin_x = 84, pin_y = 54, booth_no = null, updated_at = now()
where slug = 'toooony';

update public.adventure_partners set
  zone = 'friendship', pin_x = 56, pin_y = 90, booth_no = '65', updated_at = now()
where slug = 'lilac';

update public.adventure_partners set
  zone = 'ai_lab', pin_x = 70, pin_y = 16, booth_no = null, updated_at = now()
where slug = 'adg';

update public.adventure_partners set
  zone = 'ai_lab', pin_x = 80, pin_y = 24, booth_no = null, updated_at = now()
where slug = 'yixi';

update public.adventure_partners set
  zone = 'knowledge_tree', pin_x = 20, pin_y = 40, booth_no = null, updated_at = now()
where slug = 'soma';

update public.adventure_partners set
  zone = 'ai_lab', pin_x = 64, pin_y = 26, booth_no = null, updated_at = now()
where slug = 'kitkit';

-- 一息物料图同时作为二维码展示源（同一张图含 Logo + QR）。
insert into public.partner_media (partner_id, kind, storage_path, public_url, mime_type, sort_order)
select
  p.id,
  'qr',
  m.storage_path,
  m.public_url,
  m.mime_type,
  1
from public.adventure_partners p
join public.partner_media m
  on m.partner_id = p.id
 and m.kind = 'logo'
where p.slug = 'yixi'
  and not exists (
    select 1 from public.partner_media q
    where q.partner_id = p.id and q.kind = 'qr'
  );
