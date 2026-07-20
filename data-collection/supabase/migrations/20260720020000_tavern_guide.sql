-- Guided tavern entry: identity + today's task + blocker -> today's special.

insert into public.templates (
  slug, name, description, field_schema, is_system, version, render_type, is_active
) values (
  'tavern-guide',
  '种种酒馆今日酒单',
  '桂花的入馆引导：写下身份、今天想做的事与当前卡点，生成今日特调。',
  '[
    {"key":"identity","label":"你今天以什么身份到来？","type":"select","required":true,"options":["创作者","开发者","产品 / 运营","学生","正在探索的人"]},
    {"key":"task","label":"今天想端上吧台的事","type":"textarea","required":true},
    {"key":"blocker","label":"现在最卡的地方","type":"textarea","required":false}
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
