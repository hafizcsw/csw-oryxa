-- Temporarily reset draft 774 for publish proof, and clear the published program's ielts_required to prove the RPC writes it
UPDATE program_draft SET review_status = 'pending_review' WHERE id = 774;
UPDATE programs SET ielts_required = NULL, ielts_min_overall = NULL WHERE id = '8b6cebb6-1b69-439d-a998-db0b0fe5afd2';