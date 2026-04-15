-- Re-test ECTS trigger with correct review_status value
UPDATE program_draft SET status = 'extracted', review_status = 'pending' WHERE id = 2732;
UPDATE program_draft SET status = 'published', review_status = 'published', ects_credits = 180 WHERE id = 2732;