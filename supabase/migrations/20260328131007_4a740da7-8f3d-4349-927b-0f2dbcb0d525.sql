
INSERT INTO city_coordinates (city_name, country_code, lat, lon) VALUES
('Gzhel''', 'RU', 55.6119281, 38.3929755),
('Kazan''', 'RU', 55.7946485, 49.1115022),
('Kamensk-Shakhtinskiy', 'RU', 48.3166, 40.2616),
('Orël', 'RU', 52.9709262, 36.0642127),
('Prokop''yevsk', 'RU', 53.8863, 86.7145),
('Ryazan''', 'RU', 54.6295687, 39.7425039),
('Sal''sk', 'RU', 46.476669, 41.541008),
('Semënov', 'RU', 56.7912, 44.5099),
('Stavropol''', 'RU', 45.0428, 41.9734),
('Syzran''', 'RU', 53.15538, 48.474121),
('Pyatigorsk State', 'RU', 44.0375437, 43.0363667),
('Kursk State', 'RU', 51.7503023, 36.1963755),
('Orlovskiy', 'RU', 46.869869, 42.051865),
('Al''met''yevsk', 'RU', 54.9005, 52.2964),
('Moscow Region', 'RU', 55.8, 37.8)
ON CONFLICT (city_name, country_code) DO UPDATE SET lat = EXCLUDED.lat, lon = EXCLUDED.lon;
