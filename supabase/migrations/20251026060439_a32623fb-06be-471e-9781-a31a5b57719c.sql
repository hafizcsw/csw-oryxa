-- Add display_order column to countries table for homepage ordering
ALTER TABLE countries 
ADD COLUMN display_order INTEGER DEFAULT 999;

-- Add comment
COMMENT ON COLUMN countries.display_order IS 'Order for displaying countries on homepage (lower numbers appear first)';

-- Set initial order for existing countries (Australia first, then others alphabetically)
UPDATE countries SET display_order = 1 WHERE slug = 'au';
UPDATE countries SET display_order = 2 WHERE slug = 'ca';
UPDATE countries SET display_order = 3 WHERE slug = 'uk';
UPDATE countries SET display_order = 4 WHERE slug = 'de';
UPDATE countries SET display_order = 5 WHERE slug = 'nl';
UPDATE countries SET display_order = 6 WHERE slug = 'cn';
UPDATE countries SET display_order = 7 WHERE slug = 'jp';
UPDATE countries SET display_order = 8 WHERE slug = 'tr';
UPDATE countries SET display_order = 9 WHERE slug = 'ru';