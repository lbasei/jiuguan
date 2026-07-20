-- Field journey for the tavern: digital park -> promise pool -> ADV voucher.
-- This extends the existing conversion layer and does not alter legacy templates.

insert into public.templates (
  slug, name, description, field_schema, is_system, version, render_type, is_active
) values
(
  'tavern-park',
  '种种酒馆联名游园',
  '选择一个联名摊位、角色或地点，记录线下游园中的一枚地图印章。',
  '[
    {"key":"park_stop","label":"游园点位","type":"select","required":true,"options":["联名摊位","角色角落","故事地标","承诺池"]},
    {"key":"partner_name","label":"联名方 / 摊位名称","type":"text","required":false},
    {"key":"note","label":"现场小记","type":"textarea","required":false}
  ]'::jsonb,
  true, 1, 'route-record', true
),
(
  'tavern-promise',
  '种种酒馆承诺池',
  '留下想完成的事、期限、重要程度与愿意投入的时间，领取 ADV 创始体验码。',
  '[
    {"key":"promise","label":"想完成的事","type":"textarea","required":true},
    {"key":"deadline","label":"完成期限","type":"select","required":true,"options":["今天","三天内","一周内","一个月内"]},
    {"key":"importance","label":"重要程度","type":"select","required":true,"options":["1","2","3","4","5"]},
    {"key":"time_commitment","label":"愿意投入的时间","type":"select","required":true,"options":["10 分钟","30 分钟","1 小时","2 小时以上"]}
  ]'::jsonb,
  true, 1, 'result-card', true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  field_schema = excluded.field_schema,
  render_type = excluded.render_type,
  is_active = excluded.is_active,
  updated_at = now();
