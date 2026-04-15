INSERT INTO city_coordinates (city_name, country_code, lat, lon)
VALUES ('Saint Petersburg', 'RU', 59.93, 30.32)
ON CONFLICT DO NOTHING;