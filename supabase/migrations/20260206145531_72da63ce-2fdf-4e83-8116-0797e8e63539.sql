
-- تعديل القيد لإضافة uniranks كنظام تصنيف مسموح
ALTER TABLE institution_rankings DROP CONSTRAINT institution_rankings_ranking_system_check;

ALTER TABLE institution_rankings ADD CONSTRAINT institution_rankings_ranking_system_check 
  CHECK (ranking_system = ANY (ARRAY['qs'::text, 'the'::text, 'arwu'::text, 'usnews'::text, 'cwur'::text, 'uniranks'::text]));
