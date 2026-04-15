-- Add map_embed_url column to countries table
ALTER TABLE countries 
ADD COLUMN IF NOT EXISTS map_embed_url TEXT;

-- Add comment
COMMENT ON COLUMN countries.map_embed_url IS 'Google Maps embed URL for the country';