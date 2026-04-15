-- Add new columns to university_media_suggestions for real image search
ALTER TABLE university_media_suggestions
ADD COLUMN IF NOT EXISTS source text DEFAULT 'ai_generated',
ADD COLUMN IF NOT EXISTS search_query text,
ADD COLUMN IF NOT EXISTS original_url text,
ADD COLUMN IF NOT EXISTS confidence_score numeric,
ADD COLUMN IF NOT EXISTS alternative_urls jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN university_media_suggestions.source IS 'Source of the image: web_search or ai_generated';
COMMENT ON COLUMN university_media_suggestions.search_query IS 'The search query used to find the image';
COMMENT ON COLUMN university_media_suggestions.original_url IS 'Original URL of the image if from web search';
COMMENT ON COLUMN university_media_suggestions.confidence_score IS 'Confidence score for the image relevance (0-1)';
COMMENT ON COLUMN university_media_suggestions.alternative_urls IS 'Alternative image URLs from search results';