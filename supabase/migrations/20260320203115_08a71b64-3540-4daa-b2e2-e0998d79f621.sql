-- ECTS proof gate: set ECTS on draft and publish it to trigger trg_copy_ects_on_publish
UPDATE program_draft SET ects_credits = 180, status = 'published' WHERE id = 2732;