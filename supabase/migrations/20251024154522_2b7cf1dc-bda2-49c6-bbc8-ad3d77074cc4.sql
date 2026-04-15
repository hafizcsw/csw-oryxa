-- Add rich_content column to countries table to store detailed country guides
ALTER TABLE countries 
ADD COLUMN IF NOT EXISTS rich_content JSONB;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_countries_rich_content ON countries USING GIN (rich_content);

-- Add comment
COMMENT ON COLUMN countries.rich_content IS 'Detailed country guide content including sections, universities data, programs, fees, etc.';