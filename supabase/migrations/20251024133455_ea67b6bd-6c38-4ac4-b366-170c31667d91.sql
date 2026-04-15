-- Drop old incorrect function
DROP FUNCTION IF EXISTS populate_review_queue_from_run(BIGINT);

-- Create correct function to populate review queue from harvest_results
CREATE OR REPLACE FUNCTION populate_review_queue_from_job(p_job_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- Insert harvest_results into harvest_review_queue
  WITH inserted AS (
    INSERT INTO harvest_review_queue (
      ingestion_id,
      university_name,
      country_code,
      has_tuition,
      has_admissions,
      has_programs,
      tuition_range,
      ai_confidence,
      verified,
      auto_approved
    )
    SELECT 
      gen_random_uuid() as ingestion_id,
      hr.university_name,
      hj.country_code,
      hr.has_official_fees as has_tuition,
      CASE WHEN array_length(hr.admissions_urls, 1) > 0 THEN true ELSE false END as has_admissions,
      false as has_programs,
      NULL as tuition_range,
      CAST(hr.confidence * 100 AS INTEGER) as ai_confidence,
      false as verified,
      false as auto_approved
    FROM harvest_results hr
    JOIN harvest_jobs hj ON hj.id = hr.job_id
    WHERE hr.job_id = p_job_id
      -- Don't duplicate entries already in queue
      AND NOT EXISTS (
        SELECT 1 FROM harvest_review_queue hrq 
        WHERE hrq.university_name = hr.university_name
        AND hrq.country_code = hj.country_code
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted;
  
  RETURN inserted_count;
END;
$$;