
-- Delete 100 random universities with all related data
-- Using a CTE to select the random universities once and reuse

WITH random_unis AS (
  SELECT id, name FROM universities ORDER BY RANDOM() LIMIT 100
),
-- Delete program subjects first
deleted_subjects AS (
  DELETE FROM program_subjects 
  WHERE program_id IN (
    SELECT p.id FROM programs p 
    WHERE p.university_id IN (SELECT id FROM random_unis)
  )
  RETURNING program_id
),
-- Delete program intakes
deleted_intakes AS (
  DELETE FROM program_intakes 
  WHERE program_id IN (
    SELECT p.id FROM programs p 
    WHERE p.university_id IN (SELECT id FROM random_unis)
  )
  RETURNING program_id
),
-- Delete programs
deleted_programs AS (
  DELETE FROM programs 
  WHERE university_id IN (SELECT id FROM random_unis)
  RETURNING id
),
-- Delete university media suggestions
deleted_media AS (
  DELETE FROM university_media_suggestions 
  WHERE university_id IN (SELECT id FROM random_unis)
  RETURNING id
),
-- Delete from slider
deleted_slider AS (
  DELETE FROM slider_universities 
  WHERE university_id IN (SELECT id FROM random_unis)
  RETURNING id
),
-- Delete university drafts by name match
deleted_drafts AS (
  DELETE FROM university_draft 
  WHERE name IN (SELECT name FROM random_unis)
  RETURNING id
)
-- Finally delete the universities
DELETE FROM universities 
WHERE id IN (SELECT id FROM random_unis);
