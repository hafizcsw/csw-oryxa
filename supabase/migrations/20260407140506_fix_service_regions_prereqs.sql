-- Replay-safe prerequisite seed for service_regions expected by paid_services

INSERT INTO public.service_regions (id, slug, name_key)
VALUES
  ('f85dfe44-a051-45f7-8f9f-4efd55f8f14e', 'africa', 'services.region.africa'),
  ('575646a3-17f6-45bb-91a2-e0b05557eee8', 'south-america', 'services.region.southAmerica'),
  ('d1a5694c-ffc1-4e76-a905-651c5e67d81e', 'north-america', 'services.region.northAmerica'),
  ('ba2ffdb6-0a84-4a44-908f-47f9d2cdd40b', 'oceania', 'services.region.oceania')
ON CONFLICT (slug) DO NOTHING;