INSERT INTO public.city_coordinates (city_name, country_code, lat, lon) VALUES
  ('Cape Coast', 'GH', 5.1036, -1.2466),
  ('Koforidua', 'GH', 6.0941, -0.2576),
  ('Sunyani', 'GH', 7.3349, -2.3269),
  ('Tamale', 'GH', 9.4008, -0.8393),
  ('Winneba', 'GH', 5.3513, -0.6246),
  ('Ho', 'GH', 6.6009, 0.4713),
  ('Tarkwa', 'GH', 5.3018, -1.9931),
  ('Kumasi', 'GH', 6.6885, -1.6244),
  ('Takoradi', 'GH', 4.8976, -1.7603),
  ('Navrongo', 'GH', 10.8940, -1.0921),
  ('Wa', 'GH', 10.0601, -2.5099),
  ('Bolgatanga', 'GH', 10.7855, -0.8514),
  ('Tema', 'GH', 5.6698, -0.0166)
ON CONFLICT DO NOTHING;