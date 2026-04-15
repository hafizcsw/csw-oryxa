# ORDER_TO_LAV_17 — CRM Pilot Operational Guide

**Goal**: Connect Website → CRM (secure Pilot) via Outbox/Dispatcher. WhatsApp stays **OFF** until CRM proves stable for 1-2 days.

---

## 0) Environment Variables (Shell Session)

```bash
export EDGE_URL="https://alkhaznaqdlxygeznapt.supabase.co/functions/v1"
export CRM_WEBHOOK_URL="https://YOUR-CRM.DOMAIN/webhooks/applications"
export CRM_BEARER_TOKEN="Bearer REPLACE_WITH_CRM_TOKEN"
```

---

## 1) Enable CRM Channel Only (Flags/Settings) — SQL

Execute in Supabase SQL Editor. **Do not touch WhatsApp/Voice**.

```sql
-- Enable CRM channel (Pilot)
INSERT INTO feature_flags(key, value) VALUES
  ('crm_enabled', '{"enabled": true}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- CRM endpoint settings (Webhook + Bearer token) - using feature_settings table
INSERT INTO feature_settings(key, value) VALUES
  ('crm_webhook_url', '{"url": "REPLACE_AT_RUNTIME"}'),
  ('crm_auth_header', '{"header":"Authorization","value":"Bearer REPLACE_AT_RUNTIME"}'),
  ('crm_timeout_ms', '{"value": 5000}'),
  ('crm_max_retries', '{"value": 5}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Keep WhatsApp/Voice OFF
INSERT INTO feature_flags(key, value) VALUES
  ('whatsapp_enabled',  '{"enabled": false}'),
  ('voice_bot_enabled', '{"enabled": false}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Quick verification
SELECT key, value FROM feature_flags 
WHERE key IN ('crm_enabled','whatsapp_enabled','voice_bot_enabled');

SELECT key, value FROM feature_settings 
WHERE key IN ('crm_webhook_url','crm_auth_header','crm_timeout_ms','crm_max_retries') 
ORDER BY key;
```

**Update runtime values** (via UI or quick SQL):

```sql
UPDATE feature_settings 
SET value = jsonb_build_object('url', 'https://YOUR-CRM.DOMAIN/webhooks/applications') 
WHERE key='crm_webhook_url';

UPDATE feature_settings 
SET value = jsonb_build_object('header', 'Authorization', 'value', 'Bearer YOUR_CRM_TOKEN')
WHERE key='crm_auth_header';
```

---

## 2) Verify apply-submit-v2 Creates Outbox on CRM Enable

The edge function now automatically creates an outbox entry when `crm_enabled=true`.

**Check the logic** in `supabase/functions/apply-submit-v2/index.ts`:
- After successful application insert
- Checks `crm_enabled` flag
- Creates `integration_outbox` entry with idempotency

---

## 3) Generate Real Event (Apply) — cURL

```bash
# Send real Apply request to Edge (should generate outbox if flag ON)
curl -s -X POST "$EDGE_URL/apply-submit-v2" \
 -H "Content-Type: application/json" \
 -H "Idempotency-Key: test@example.com::PRG-1" \
 -d '{
   "student_name":"Pilot User",
   "email":"test@example.com",
   "program_id":"PRG-1",
   "privacy_consent":true,
   "whatsapp_opt_in":false
 }' | jq .
```

**Verify Outbox — SQL**

```sql
SELECT id, target, status, attempts, idempotency_key, created_at
FROM integration_outbox
WHERE target='crm'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: New row with status `pending`.

---

## 4) Dispatch to CRM — cURL

If you have `crm-dispatch` function deployed:

```bash
curl -s -X POST "$EDGE_URL/crm-dispatch" | jq .
```

**Expected Results:**
- ✅ Success: Item transitions to `sent`, event `crm_dispatch_sent` logged
- ❌ Failure (500/timeout): Stays `pending` with `next_attempt_at` (backoff) or moves to `error` after exceeding `max_retries`

**Check Status — SQL**

```sql
-- Outbox status summary
SELECT target, status, count(*) 
FROM integration_outbox 
GROUP BY 1,2 
ORDER BY 1,2;

-- Recent dispatch events
SELECT event, count(*) n
FROM analytics_events
WHERE event IN ('crm_dispatch_sent','crm_dispatch_error')
  AND at >= now() - interval '24 hours'
GROUP BY event 
ORDER BY n DESC;
```

---

## 5) What Should You See in CRM?

Your existing CRM should receive:
- POST to `/webhooks/applications` with **Idempotency-Key** header
- No duplicates: If resent with same key, CRM returns **409** (treated as success)
- **Stage movement via RPC only** (no direct UPDATE)

**Reference Webhook Handler** — See `crm-webhook-handler.js` for implementation:
1. Verify Bearer token
2. Check idempotency (integration_inbox)
3. Upsert customer by email
4. Insert application
5. Call `rpc_move_customer_stage_with_source(...)` — **RPC only**
6. Log idempotency and return 200

---

## 6) Go/No-Go Decision — Quick Check

**✅ GO if:**
- Outbox items transition to `sent` consistently (no accumulation)
- CRM receives and moves stage via RPC without errors
- No more than 3 consecutive `crm_dispatch_error` events in 30 minutes

**❌ NO-GO / Rollback:**

```sql
UPDATE feature_flags
SET value = jsonb_set(value,'{enabled}', 'false'::jsonb, true)
WHERE key='crm_enabled';
```

> Setting **OFF** stops dispatching immediately (items remain pending/error, not deleted).

---

## 7) Enable WhatsApp Later (Pilot) — After CRM Proves Stable

Stays **OFF** now to minimize cost. When ready to test:

**Enable Flag (SQL)**

```sql
UPDATE feature_flags
SET value = jsonb_set(value,'{enabled}', 'true'::jsonb, true)
WHERE key='whatsapp_enabled';
```

**Dispatch Policy** (in your dispatcher):
- Send **text only**
- No send without: `privacy_consent=true` AND `whatsapp_opt_in=true`
- Low rate: `rate_per_min`, daily `daily_quota`
- Max 5 retries + exponential backoff → DLQ

**WhatsApp Acceptance:**
- Text messages arrive on Pilot numbers only
- No excess cost or duplication

**WhatsApp Rollback:**

```sql
UPDATE feature_flags
SET value = jsonb_set(value,'{enabled}', 'false'::jsonb, true)
WHERE key='whatsapp_enabled';
```

---

## 8) Cost Control Reminders

- **No GPT** in this flow
- Outbox/Dispatchers work **text-only**
- Monitor `p50/p95` for dispatch functions (optional)

**Telemetry (Optional)**

```sql
SELECT event,
       round(avg(latency_ms))::int AS p50,
       percentile_disc(0.95) within group (order by latency_ms) AS p95,
       count(*)::int n
FROM analytics_events
WHERE event IN ('crm_dispatch_sent','crm_dispatch_error')
  AND at >= now() - interval '7 days'
GROUP BY event 
ORDER BY p95 DESC;
```

---

## Executive Summary — Now

1. ✅ Enable `crm_enabled=true` and set `crm_webhook_url` + `crm_auth_header`
2. ✅ Send Apply → Verify outbox `pending`
3. ✅ Run `crm-dispatch` → Watch transition to `sent` with minimal errors
4. ✅ If stable for several hours, CRM Pilot is successful
5. ⏸️ WhatsApp stays OFF until separate Pilot decision

---

## Monitoring Dashboard

Access at: `/admin/integrations`
- View real-time stats (pending/sent/error)
- Recent outbox items
- Manual dispatch triggers
- Retry/Skip failed items

---

## Troubleshooting

**Items stuck in `pending`:**
```sql
SELECT * FROM integration_outbox 
WHERE status='pending' AND target='crm' 
ORDER BY created_at 
LIMIT 10;
```

**Check CRM connectivity:**
```bash
curl -X POST "$CRM_WEBHOOK_URL" \
  -H "Authorization: $CRM_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-123" \
  -d '{"application":{"email":"test@example.com","student_name":"Test"}}'
```

**Reset error items for retry:**
```sql
UPDATE integration_outbox 
SET status='pending', attempts=0, next_attempt_at=now() 
WHERE status='error' AND target='crm';
```
