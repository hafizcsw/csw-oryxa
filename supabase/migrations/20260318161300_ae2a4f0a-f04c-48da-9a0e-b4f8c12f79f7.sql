
-- Apply 8 clean matched rows (no conflicts)
UPDATE universities SET website = 'https://hkust.edu.hk' WHERE id = 'bf4fa4b3-9864-480a-8a7f-a772d5079992' AND website IS NULL;
UPDATE universities SET website = 'https://adelaideuni.edu.au' WHERE id = '431d8402-978d-4b9c-9eeb-ae81635fafad' AND website IS NULL;
UPDATE universities SET website = 'https://www.ucl.ac.uk' WHERE id = '6b725da7-4d83-4a76-9310-518292fc884a' AND website IS NULL;
UPDATE universities SET website = 'https://www.lse.ac.uk' WHERE id = '67d9e5c2-338f-446f-895e-803cac94fb3b' AND website IS NULL;
UPDATE universities SET website = 'https://www.ip-paris.fr' WHERE id = 'b91ed15a-534f-4b8d-8ab3-d9c67a0ecde3' AND website IS NULL;
UPDATE universities SET website = 'https://ucsd.edu' WHERE id = '6677b573-950c-4344-89ee-651abd3cc42f' AND website IS NULL;
UPDATE universities SET website = 'https://www.osaka-u.ac.jp' WHERE id = '908481ea-73d3-4ac4-8e8a-302894297bbf' AND website IS NULL;
UPDATE universities SET website = 'https://www.kth.se' WHERE id = 'a3161424-7329-4ecb-a5c6-3f670f13396b' AND website IS NULL;

-- Mark the 8 applied rows
UPDATE website_enrichment_rows 
SET enrichment_status = 'applied', updated_at = now()
WHERE job_id = '5185afdd-45c4-4945-80ba-7c4c5e54f7e0'
  AND enrichment_status = 'matched'
  AND university_id IN (
    'bf4fa4b3-9864-480a-8a7f-a772d5079992',
    '431d8402-978d-4b9c-9eeb-ae81635fafad',
    '6b725da7-4d83-4a76-9310-518292fc884a',
    '67d9e5c2-338f-446f-895e-803cac94fb3b',
    'b91ed15a-534f-4b8d-8ab3-d9c67a0ecde3',
    '6677b573-950c-4344-89ee-651abd3cc42f',
    '908481ea-73d3-4ac4-8e8a-302894297bbf',
    'a3161424-7329-4ecb-a5c6-3f670f13396b'
  );

-- Mark the 6 conflict rows as blocked (duplicate entity already has this domain)
UPDATE website_enrichment_rows 
SET enrichment_status = 'review', 
    match_reason = match_reason || ',blocked:duplicate_entity_conflict',
    updated_at = now()
WHERE job_id = '5185afdd-45c4-4945-80ba-7c4c5e54f7e0'
  AND enrichment_status = 'matched'
  AND university_id IN (
    '0f9ed2af-e957-419d-89c2-3ea2fa628817',
    'f7aee326-2d36-4513-afae-eac6389518ed',
    'ced3236e-70f2-4823-9218-d6a8b2b2351a',
    '82db49a7-801b-4d22-8a43-176bae41951c',
    '8157ce7e-1200-4586-9a22-ae33c029b22a',
    'a1b4feff-b942-4cd0-b2d8-796436845c0d'
  );
