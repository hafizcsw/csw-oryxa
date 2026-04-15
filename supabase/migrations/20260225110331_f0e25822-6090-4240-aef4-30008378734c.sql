
-- =============================================
-- EGYPT CITY BACKFILL — Manual accurate mapping
-- =============================================

-- Step 1: Add Egyptian city coordinates
INSERT INTO city_coordinates (city_name, country_code, lat, lon) VALUES
  ('Giza', 'EG', 30.01, 31.21),
  ('Mansoura', 'EG', 31.04, 31.38),
  ('Tanta', 'EG', 30.79, 31.00),
  ('Assiut', 'EG', 27.18, 31.18),
  ('Aswan', 'EG', 24.09, 32.90),
  ('Ismailia', 'EG', 30.60, 32.27),
  ('Zagazig', 'EG', 30.59, 31.50),
  ('Benha', 'EG', 30.47, 31.18),
  ('Beni Suef', 'EG', 29.07, 31.10),
  ('Fayoum', 'EG', 29.31, 30.84),
  ('Minia', 'EG', 28.10, 30.75),
  ('Sohag', 'EG', 26.56, 31.69),
  ('Qena', 'EG', 26.16, 32.73),
  ('Luxor', 'EG', 25.69, 32.64),
  ('Damanhour', 'EG', 31.04, 30.47),
  ('Kafr El Sheikh', 'EG', 31.11, 30.94),
  ('Damietta', 'EG', 31.42, 31.81),
  ('Port Said', 'EG', 31.26, 32.28),
  ('Suez', 'EG', 29.97, 32.55),
  ('Arish', 'EG', 31.13, 33.80),
  ('Hurghada', 'EG', 27.26, 33.81),
  ('Marsa Matrouh', 'EG', 31.35, 27.24),
  ('6th of October City', 'EG', 29.93, 30.92),
  ('New Cairo', 'EG', 30.03, 31.47),
  ('Sadat City', 'EG', 30.37, 30.53),
  ('Shebin El Kom', 'EG', 30.56, 31.01),
  ('El Alamein', 'EG', 30.83, 29.50),
  ('New Administrative Capital', 'EG', 30.02, 31.76),
  ('Galala', 'EG', 29.87, 32.35),
  ('10th of Ramadan City', 'EG', 30.30, 31.75)
ON CONFLICT (city_name, country_code) DO NOTHING;

-- Step 2: Fix and assign cities to all Egyptian universities
-- Cairo universities
UPDATE universities SET city = 'Cairo' WHERE id IN (
  '7d9bc2d4-5a6d-4ab4-b8b5-809fb03185d3', -- Cairo University
  '9e076ed9-2b31-4a42-9a59-64f856eccce6', -- American University in Cairo
  '4ea371f5-fb3e-43c3-a923-fc44fd74b69a', -- Al-Azhar University
  '62036c49-7c7a-411d-a055-e2ac607efff7', -- Ain Shams University
  'af066965-53b5-4e08-8475-484d34a59ca6', -- Arab Academy for Science & Technology
  '73822d5f-ef66-411e-98a7-747f17b24440', -- Arab Open University Egypt
  '61b93b55-1490-4fee-abee-f95b1aabe9af', -- Egyptian E Learning University
  'f368059c-4c49-427c-a2b4-a6ad4546cbe5', -- ESLSCA University Egypt
  '7b27ce39-6502-4d00-a48a-4e0bad505a3a'  -- MISR University for Science & Technology
);

-- Giza universities
UPDATE universities SET city = 'Giza' WHERE id IN (
  'baad2199-fae4-4d19-a5fc-cea6420353a9'  -- Ahram Canadian University (6th October/Giza)
);

-- 6th of October City universities
UPDATE universities SET city = '6th of October City' WHERE id IN (
  '3a2a93dd-7852-4b0f-a467-ba7773ac8fbe', -- Misr International University
  'b16813af-4e5e-4ade-bac2-85575e34e84f'  -- French University of Egypt
);

-- New Cairo universities
UPDATE universities SET city = 'New Cairo' WHERE id IN (
  '14029685-0a9a-4c54-b0b4-a445e0079ff4', -- Badr University in Cairo
  '3da480c8-4ccb-448e-b319-8aae07ef87fc', -- German University in Cairo
  '7223147c-6a5e-4471-a282-3947cb02ab9f', -- British University in Egypt
  '18c115bd-4e71-4201-a4b8-51071dd06e50', -- Egyptian Chinese University
  '7ae45f82-911c-4e73-bc34-e5df2d406bf7', -- Future University
  'a530b75f-ca95-427a-be26-3df40012e259'  -- Egyptian Russian University
);

-- Alexandria
UPDATE universities SET city = 'Alexandria' WHERE id IN (
  '0e105a64-9b1d-40f7-b151-3ea6b510137a', -- Alexandria University
  'cd1fc38f-7a72-4434-9a38-6afccee19877', -- Akhbar El Yom Academy
  'af066965-53b5-4e08-8475-484d34a59ca6'  -- Arab Academy (main campus Alexandria)
);

-- Helwan
UPDATE universities SET city = 'Helwan' WHERE id IN (
  'bc7513ac-b447-4ea4-a466-d4f26017fe2f'  -- Helwan University
);

-- Mansoura
UPDATE universities SET city = 'Mansoura' WHERE id IN (
  'db92549f-dafb-4d42-ba68-fd4dde1377ab', -- Mansoura University
  '84ab3198-46e7-44c2-ab0b-02d310a8f68e'  -- Delta University for Science & Technology
);

-- Benha
UPDATE universities SET city = 'Benha' WHERE id IN (
  '2298d458-7bf3-4917-b995-567db2bd8910'  -- Benha University
);

-- Beni Suef
UPDATE universities SET city = 'Beni Suef' WHERE id IN (
  '751aadd6-de16-4d0d-9eb7-eef977d94f81'  -- Beni Suef University
);

-- Assiut
UPDATE universities SET city = 'Assiut' WHERE id IN (
  'd15c9cc9-63ac-44b1-8526-b596495846a1'  -- Assiut University
);

-- Aswan
UPDATE universities SET city = 'Aswan' WHERE id IN (
  '6ed3335e-3d5e-4482-a44f-6f10aefef7d4'  -- Aswan University
);

-- Fayoum
UPDATE universities SET city = 'Fayoum' WHERE id IN (
  'dc3971cd-8233-4bcb-9ea8-16d2b4c0ecac'  -- Fayoum University
);

-- Minia
UPDATE universities SET city = 'Minia' WHERE id IN (
  'f36e9488-e112-4f3c-8ba2-0916293b8cd4'  -- Minia University
);

-- Shebin El Kom (Menoufia)
UPDATE universities SET city = 'Shebin El Kom' WHERE id IN (
  '1eb77122-3ab8-4346-aa44-2c5a37330e95'  -- Menoufia University
);

-- Marsa Matrouh
UPDATE universities SET city = 'Marsa Matrouh' WHERE id IN (
  '239568ff-8d2c-437b-8b44-a26146ec64bf'  -- Matrouh University
);

-- Ismailia
UPDATE universities SET city = 'Ismailia' WHERE id IN (
  '4c9e388d-58e8-47a0-b70d-df2b01a25afb'  -- Egypt Japan University of Science & Technology
);

-- El Alamein
UPDATE universities SET city = 'El Alamein' WHERE id IN (
  '41455363-9447-4094-baf9-4ca8d3282543'  -- Al Alamein International University
);

-- Galala
UPDATE universities SET city = 'Galala' WHERE id IN (
  '49108e34-ca03-46b7-9301-ef53e0e33a90'  -- Galala University
);

-- Damietta
UPDATE universities SET city = 'Damietta' WHERE id IN (
  '1b135d87-6e36-4106-8d34-24a6f4b1942b'  -- Horus University (Damietta)
);

-- Sadat City
UPDATE universities SET city = 'Sadat City' WHERE id IN (
  '31d9ac93-879d-4000-823e-2338a688426d'  -- Alryada University
);

-- Fix Kafr El Sheikh duplicate
UPDATE universities SET city = 'Kafr El Sheikh' WHERE id IN (
  'f9c1ef07-751e-4625-a2fe-b75f4549f220'  -- Kafrelsheikh University
);

-- Fix Deraya → Minia (Deraya is in Minia governorate)
UPDATE universities SET city = 'Minia' WHERE id = '25411304-6571-431d-8fd5-1ed9f25e0cdf';
