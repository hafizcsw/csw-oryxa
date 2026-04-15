UPDATE website_enrichment_rows 
SET enrichment_status = 'pending',
    official_website_url = NULL,
    official_website_domain = NULL,
    confidence_score = NULL,
    match_reason = NULL,
    enriched_at = NULL,
    processed_at = NULL,
    locked_at = NULL,
    last_stage = 'reset_for_v11',
    updated_at = now()
WHERE id = '838660fe-3b3e-45a3-b227-78474e0a004c';

UPDATE website_enrichment_jobs 
SET status = 'running', 
    completed_at = NULL,
    last_activity_at = now()
WHERE id = '5185afdd-45c4-4945-80ba-7c4c5e54f7e0';