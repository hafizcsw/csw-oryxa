-- Create function to populate review queue from harvest run
CREATE OR REPLACE FUNCTION populate_review_queue_from_run(p_run_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- Insert ingestion_results into harvest_review_queue
  WITH inserted AS (
    INSERT INTO harvest_review_queue (
      run_id,
      university_name,
      country_code,
      official_website,
      original_data,
      extracted_data,
      status,
      ai_confidence
    )
    SELECT 
      ir.run_id,
      ir.university_name,
      ir.country_code,
      ir.official_website,
      ir.raw_data,
      ir.extracted_fields,
      'pending',
      ir.confidence_score
    FROM ingestion_results ir
    WHERE ir.run_id = p_run_id
      AND ir.state = 'extracted'
      -- Don't duplicate entries already in queue
      AND NOT EXISTS (
        SELECT 1 FROM harvest_review_queue hrq 
        WHERE hrq.run_id = ir.run_id 
        AND hrq.university_name = ir.university_name
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted;
  
  RETURN inserted_count;
END;
$$;