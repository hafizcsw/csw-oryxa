-- Add English name column to countries
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS name_en TEXT;

-- Update with English names
UPDATE public.countries SET name_en = 'Australia' WHERE slug = 'au';
UPDATE public.countries SET name_en = 'Canada' WHERE slug = 'ca';
UPDATE public.countries SET name_en = 'United Kingdom' WHERE slug = 'uk';
UPDATE public.countries SET name_en = 'China' WHERE slug = 'cn';
UPDATE public.countries SET name_en = 'Turkey' WHERE slug = 'tr';
UPDATE public.countries SET name_en = 'United States' WHERE slug = 'usa';
UPDATE public.countries SET name_en = 'Italy' WHERE slug = 'italy';
UPDATE public.countries SET name_en = 'Ireland' WHERE slug = 'ireland';
UPDATE public.countries SET name_en = 'New Zealand' WHERE slug = 'new-zealand';
UPDATE public.countries SET name_en = 'South Korea' WHERE slug = 'south-korea';
UPDATE public.countries SET name_en = 'Singapore' WHERE slug = 'singapore';
UPDATE public.countries SET name_en = 'Japan' WHERE slug = 'japan';
UPDATE public.countries SET name_en = 'Germany' WHERE slug = 'germany';
UPDATE public.countries SET name_en = 'Spain' WHERE slug = 'spain';
UPDATE public.countries SET name_en = 'Netherlands' WHERE slug = 'netherlands';
UPDATE public.countries SET name_en = 'France' WHERE slug = 'france';
UPDATE public.countries SET name_en = 'Russia' WHERE slug = 'russia';
UPDATE public.countries SET name_en = 'Malaysia' WHERE slug = 'malaysia';
UPDATE public.countries SET name_en = 'Poland' WHERE slug = 'poland';
UPDATE public.countries SET name_en = 'Hungary' WHERE slug = 'hungary';
UPDATE public.countries SET name_en = 'Cyprus' WHERE slug = 'cyprus';

-- Update Arabic names where missing (name column becomes name_ar)
ALTER TABLE public.countries RENAME COLUMN name TO name_ar;