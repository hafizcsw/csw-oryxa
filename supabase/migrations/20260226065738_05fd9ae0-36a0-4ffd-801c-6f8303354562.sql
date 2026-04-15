-- Populate Arabic names for Russian universities
-- Using transliteration/translation for well-known universities
UPDATE universities SET name_ar = CASE name_en
  WHEN 'Altai State University' THEN 'جامعة ألتاي الحكومية'
  WHEN 'Bauman Moscow State Technical University' THEN 'جامعة باومان موسكو التقنية الحكومية'
  WHEN 'Bryansk State University Academician I G Petrovskii' THEN 'جامعة بريانسك الحكومية'
  WHEN 'Buryat State University' THEN 'جامعة بوريات الحكومية'
  WHEN 'Cherepovets State University' THEN 'جامعة تشيريبوفيتس الحكومية'
  WHEN 'Crimean Federal University named after B.N. Vernadsky' THEN 'جامعة القرم الفيدرالية'
  WHEN 'Don State Technical University' THEN 'جامعة الدون التقنية الحكومية'
  WHEN 'European University Saint Petersburg' THEN 'الجامعة الأوروبية في سانت بطرسبورغ'
  WHEN 'Far Eastern Federal University' THEN 'جامعة الشرق الأقصى الفيدرالية'
  WHEN 'Grozny State Petroleum Technical University MD Millionshchikov' THEN 'جامعة غروزني التقنية الحكومية للنفط'
  WHEN 'Gubkin Russian State University of Oil & Gas' THEN 'جامعة غوبكين الروسية الحكومية للنفط والغاز'
  WHEN 'Moscow Aviation Institute National Research University' THEN 'معهد موسكو للطيران - جامعة بحثية وطنية'
  WHEN 'Moscow Pedagogical State University' THEN 'جامعة موسكو التربوية الحكومية'
  WHEN 'Moscow State Technological University Stankin' THEN 'جامعة موسكو التكنولوجية الحكومية ستانكين'
  WHEN 'National Nuclear Research University' THEN 'الجامعة الوطنية للأبحاث النووية'
  WHEN 'National Research University Higher School Of Economics' THEN 'المدرسة العليا للاقتصاد - جامعة بحثية وطنية'
  WHEN 'National University of Science & Technology MISIS' THEN 'الجامعة الوطنية للعلوم والتكنولوجيا ميسيس'
  WHEN 'Novosibirsk State Technical University' THEN 'جامعة نوفوسيبيرسك التقنية الحكومية'
  WHEN 'Novosibirsk State University' THEN 'جامعة نوفوسيبيرسك الحكومية'
  WHEN 'Peter the Great St.Petersburg Polytechnic University' THEN 'جامعة بطرس الأكبر للفنون التطبيقية في سانت بطرسبورغ'
  WHEN 'Russian Presidential Academy of National Economy & Public Administration' THEN 'أكاديمية الاقتصاد الوطني والإدارة العامة الروسية'
  WHEN 'Russian State Social University' THEN 'الجامعة الروسية الحكومية الاجتماعية'
  WHEN 'Russian University of Economics G V Plekhanov' THEN 'جامعة بليخانوف الروسية للاقتصاد'
  WHEN 'Voronezh State Technical University' THEN 'جامعة فورونيج التقنية الحكومية'
  ELSE 'جامعة ' || COALESCE(name_en, '')
END
WHERE name_ar IS NULL
AND id IN (SELECT DISTINCT university_id FROM programs WHERE currency_code = 'RUB');