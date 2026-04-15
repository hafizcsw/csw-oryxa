
INSERT INTO city_coordinates (city_name, country_code, lat, lon) VALUES
('Al' || chr(8217) || 'met' || chr(8217) || 'yevsk', 'RU', 54.9005, 52.2964),
('Gzhel' || chr(8217), 'RU', 55.6119, 38.3930),
('Kazan' || chr(8217), 'RU', 55.7946, 49.1115),
('Prokop' || chr(8217) || 'yevsk', 'RU', 53.8863, 86.7145),
('Ryazan' || chr(8217), 'RU', 54.6296, 39.7425),
('Sal' || chr(8217) || 'sk', 'RU', 46.4767, 41.5410),
('Stavropol' || chr(8217), 'RU', 45.0428, 41.9734),
('Syzran' || chr(8217), 'RU', 53.1554, 48.4741)
ON CONFLICT (city_name, country_code) DO UPDATE SET lat = EXCLUDED.lat, lon = EXCLUDED.lon;
