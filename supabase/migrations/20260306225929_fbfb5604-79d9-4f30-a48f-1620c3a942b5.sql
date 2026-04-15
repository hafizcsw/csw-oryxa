UPDATE uniranks_crawl_state 
SET 
  source = 'qs', 
  source_profile_url = CASE university_id 
    WHEN '161523ba-1055-4915-8cb5-72deff3f9376' THEN 'https://www.topuniversities.com/universities/university-oxford'
    WHEN 'e5a4582c-784a-4095-9aff-d01ac0c09cae' THEN 'https://www.topuniversities.com/universities/abu-dhabi-university'
    WHEN '9b1f1076-8281-4394-a1d0-8acb136db6b0' THEN 'https://www.topuniversities.com/universities/american-university-ras-al-khaimah-aurak'
  END,
  qs_slug = CASE university_id 
    WHEN '161523ba-1055-4915-8cb5-72deff3f9376' THEN 'university-oxford'
    WHEN 'e5a4582c-784a-4095-9aff-d01ac0c09cae' THEN 'abu-dhabi-university'
    WHEN '9b1f1076-8281-4394-a1d0-8acb136db6b0' THEN 'american-university-ras-al-khaimah-aurak'
  END,
  stage = 'profile_pending',
  retry_count = 0,
  retry_budget = 3,
  entity_type = 'university',
  locked_until = NULL,
  updated_at = now()
WHERE university_id IN (
  '161523ba-1055-4915-8cb5-72deff3f9376',
  'e5a4582c-784a-4095-9aff-d01ac0c09cae',
  '9b1f1076-8281-4394-a1d0-8acb136db6b0'
);