
-- Add 'processing' to enrichment_status constraint
ALTER TABLE website_enrichment_rows DROP CONSTRAINT website_enrichment_rows_enrichment_status_check;
ALTER TABLE website_enrichment_rows ADD CONSTRAINT website_enrichment_rows_enrichment_status_check 
  CHECK (enrichment_status = ANY (ARRAY['pending','processing','matched','review','failed','skipped','approved','rejected','applied','skipped_existing']));

-- Add lane sources to match_source constraint
ALTER TABLE website_enrichment_rows DROP CONSTRAINT website_enrichment_rows_match_source_check;
ALTER TABLE website_enrichment_rows ADD CONSTRAINT website_enrichment_rows_match_source_check 
  CHECK (match_source = ANY (ARRAY['openalex','ror','wikidata','web','manual','lane_a_openalex','lane_a_ror','lane_b_ddg','openalex_crosscheck','openalex_crosscheck_only']));
