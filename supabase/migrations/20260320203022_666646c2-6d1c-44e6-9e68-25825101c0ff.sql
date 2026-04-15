-- Publish university contacts for Cardiff Met (proof gate)
SELECT rpc_publish_university_contacts('380ad74d-19d0-48c2-8c22-b8ad272c3bd5'::uuid, 'proof-gate-cardiff');
-- Publish university offices for Cardiff Met (proof gate)
SELECT rpc_publish_university_offices('380ad74d-19d0-48c2-8c22-b8ad272c3bd5'::uuid, 'proof-gate-cardiff');