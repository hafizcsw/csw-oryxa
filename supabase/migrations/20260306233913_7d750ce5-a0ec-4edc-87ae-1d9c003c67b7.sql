
-- Pause the crawler while we deploy new extractors
INSERT INTO crawl_settings (key, value) VALUES ('pause', '"true"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = '"true"'::jsonb;

-- Reset pilot universities to profile_pending for fresh extraction
UPDATE uniranks_crawl_state 
SET stage = 'profile_pending', locked_until = NULL, locked_by = NULL, retry_count = 0
WHERE university_id IN (
  '161523ba-1055-4915-8cb5-72deff3f9376',
  'e5a4582c-784a-4095-9aff-d01ac0c09cae',
  '9b1f1076-8281-4394-a1d0-8acb136db6b0'
);

-- Clean old section observations for these universities
DELETE FROM qs_section_observations 
WHERE entity_profile_id IN (
  SELECT id FROM qs_entity_profiles WHERE university_id IN (
    '161523ba-1055-4915-8cb5-72deff3f9376',
    'e5a4582c-784a-4095-9aff-d01ac0c09cae',
    '9b1f1076-8281-4394-a1d0-8acb136db6b0'
  )
);

-- Clean old programme details for these universities
DELETE FROM qs_programme_details 
WHERE entity_profile_id IN (
  SELECT id FROM qs_entity_profiles WHERE university_id IN (
    '161523ba-1055-4915-8cb5-72deff3f9376',
    'e5a4582c-784a-4095-9aff-d01ac0c09cae',
    '9b1f1076-8281-4394-a1d0-8acb136db6b0'
  )
);

-- Clean old program_draft entries from QS for these universities
DELETE FROM program_draft 
WHERE university_id IN (
  '161523ba-1055-4915-8cb5-72deff3f9376',
  'e5a4582c-784a-4095-9aff-d01ac0c09cae',
  '9b1f1076-8281-4394-a1d0-8acb136db6b0'
)
AND program_key LIKE 'qs:%';

-- Reset program_urls to pending for re-extraction
UPDATE program_urls 
SET status = 'pending', fetch_error = NULL
WHERE university_id IN (
  '161523ba-1055-4915-8cb5-72deff3f9376',
  'e5a4582c-784a-4095-9aff-d01ac0c09cae',
  '9b1f1076-8281-4394-a1d0-8acb136db6b0'
)
AND discovered_from LIKE 'door2:qs%';
