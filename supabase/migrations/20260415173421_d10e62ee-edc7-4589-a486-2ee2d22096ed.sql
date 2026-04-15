-- Seed one shortlist item so decision engine has real program context
INSERT INTO portal_shortlist (auth_user_id, program_id)
VALUES ('ea77d36f-c6c3-4aa9-a4dc-16946e084511', '42257fd4-8752-4717-9552-be8f75530ccb')
ON CONFLICT DO NOTHING;