-- Seed shortlist for the real test user (Hafez)
INSERT INTO portal_shortlist (auth_user_id, program_id)
VALUES ('3b705a5e-404f-4f07-aa54-8cec44847bf9', '42257fd4-8752-4717-9552-be8f75530ccb')
ON CONFLICT DO NOTHING;