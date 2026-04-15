# LAV #17 - CRM & WhatsApp Pilot Deployment Guide

## Overview
LAV #17 implements gradual activation of CRM and WhatsApp integrations with strict cost and privacy controls.

## ✅ Components Deployed

### 1. Edge Functions
- ✅ `crm-dispatch` - Processes outbox items to CRM webhook
- ✅ `whatsapp-dispatch` - Sends WhatsApp messages (text-only, consent-required)

### 2. Database Configuration
- ✅ Feature flags for `crm_enabled` and `whatsapp_enabled`
- ✅ Settings for CRM webhook URL and authentication
- ✅ WhatsApp rate limiting and provider configuration

### 3. Admin Monitoring
- ✅ `/admin/integrations` - Real-time monitoring dashboard
  - View pending/sent/error counts
  - Manual dispatch triggers
  - Retry failed items
  - Skip problematic items

## 🚀 Deployment Steps

### Step 1: Configure CRM (REQUIRED)

Update the CRM webhook URL and authentication in the database:

```sql
-- Replace with your actual CRM endpoint
UPDATE feature_settings 
SET value = '{"url": "https://your-crm.example.com/webhooks/applications"}'::jsonb
WHERE key = 'crm_webhook_url';

-- Replace with your actual CRM authentication token
UPDATE feature_settings 
SET value = '{"header": "Authorization", "value": "Bearer YOUR_ACTUAL_CRM_TOKEN"}'::jsonb
WHERE key = 'crm_auth_header';
```

### Step 2: Enable CRM (Pilot Mode)

CRM is already enabled by default. To verify:

```sql
SELECT key, enabled, payload 
FROM feature_flags 
WHERE key = 'crm_enabled';
```

Expected result: `enabled = true` or `payload->>'enabled' = 'true'`

### Step 3: Configure WhatsApp Provider (Optional)

Set environment variables in your Supabase project:

```bash
MAYTAPI_PRODUCT_ID=your_product_id
MAYTAPI_PHONE_ID=your_phone_id
MAYTAPI_TOKEN=your_maytapi_token
```

### Step 4: Enable WhatsApp (After CRM Success)

**Important**: Only enable WhatsApp after CRM has been running successfully for 1-2 days.

```sql
UPDATE feature_flags 
SET enabled = true,
    payload = '{"enabled": true, "rate_per_min": 10, "daily_quota": 200}'::jsonb
WHERE key = 'whatsapp_enabled';
```

## 🧪 Testing

### Test CRM Dispatch

1. Create a test application via `/apply-submit-v2`:
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/apply-submit-v2" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{
    "student_name": "Test Student",
    "email": "test@example.com",
    "phone": "+1234567890",
    "privacy_consent": true,
    "whatsapp_opt_in": false
  }'
```

2. Verify outbox entry was created:
```sql
SELECT * FROM integration_outbox 
WHERE event_type = 'application.created'
ORDER BY created_at DESC 
LIMIT 1;
```

3. Manually trigger CRM dispatch:
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/crm-dispatch" \
  -H "apikey: YOUR_ANON_KEY"
```

4. Check the result:
```sql
SELECT id, status, attempts, last_error 
FROM integration_outbox 
WHERE event_type = 'application.created'
ORDER BY created_at DESC 
LIMIT 5;
```

Expected: `status = 'sent'` and `last_error = null`

### Test WhatsApp Dispatch (After Enabling)

1. Create a test application with WhatsApp consent:
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/apply-submit-v2" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{
    "student_name": "Test Student",
    "email": "test@example.com",
    "phone": "+YOUR_PHONE_NUMBER",
    "privacy_consent": true,
    "whatsapp_opt_in": true
  }'
```

2. Manually trigger WhatsApp dispatch:
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-dispatch" \
  -H "apikey: YOUR_ANON_KEY"
```

3. Check your phone for the WhatsApp message

## 📊 Monitoring

### Admin Dashboard

Visit `/admin/integrations` to:
- View real-time statistics (Pending, Sent, Errors)
- See recent 50 outbox items
- Manually trigger dispatches
- Retry failed items
- Skip problematic items

### Database Queries

**Check pending items:**
```sql
SELECT COUNT(*) as pending_count
FROM integration_outbox
WHERE status = 'pending';
```

**Check error items:**
```sql
SELECT id, event_type, attempts, last_error, created_at
FROM integration_outbox
WHERE status = 'error'
ORDER BY created_at DESC
LIMIT 10;
```

**Check success rate:**
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM integration_outbox
GROUP BY status;
```

## 🔄 Rollback Plan

### Emergency Disable (Immediate)

```sql
-- Disable both integrations
UPDATE feature_flags 
SET enabled = false
WHERE key IN ('crm_enabled', 'whatsapp_enabled');
```

### Gradual Disable

```sql
-- Disable only WhatsApp
UPDATE feature_flags 
SET enabled = false
WHERE key = 'whatsapp_enabled';

-- Keep CRM running
```

**Note**: Pending items will remain in the outbox and can be reprocessed when re-enabled.

## 💰 Cost Controls

### CRM
- Max 10 items per dispatch
- Exponential backoff (up to 5 minutes)
- Max 5 retry attempts
- No recurring charges (webhook-based)

### WhatsApp
- Rate limit: 10 messages per minute
- Daily quota: 200 messages
- Text-only (no media)
- Requires explicit user consent (`privacy_consent=true` AND `whatsapp_opt_in=true`)

## 🔒 Privacy & Security

### Consent Requirements
- **Privacy Consent**: Required for all integrations
- **WhatsApp Opt-in**: Required specifically for WhatsApp messages

### Data Flow
1. Application submitted → `integration_outbox` created
2. Dispatch function picks up pending items
3. Checks consent flags
4. Sends to external service
5. Updates status (sent/error)
6. Logs analytics event

### No Data Sent If:
- `privacy_consent = false`
- `whatsapp_opt_in = false` (for WhatsApp only)
- Integration is disabled via feature flag

## 📝 Next Steps

1. ✅ Monitor CRM dispatch for 1-2 days
2. ✅ Verify all applications are being synced successfully
3. ✅ Check for any error patterns in `/admin/integrations`
4. ⏳ Enable WhatsApp after CRM stability confirmed
5. ⏳ Monitor WhatsApp delivery rates
6. ⏳ Set up automated cron jobs for dispatch functions

## 🆘 Troubleshooting

### CRM Not Receiving Data

1. Check feature flag is enabled:
```sql
SELECT * FROM feature_flags WHERE key = 'crm_enabled';
```

2. Verify webhook URL is correct:
```sql
SELECT * FROM feature_settings WHERE key = 'crm_webhook_url';
```

3. Check authentication token:
```sql
SELECT * FROM feature_settings WHERE key = 'crm_auth_header';
```

4. Review error logs:
```sql
SELECT last_error, attempts 
FROM integration_outbox 
WHERE status = 'error'
ORDER BY created_at DESC;
```

### WhatsApp Messages Not Sending

1. Verify WhatsApp is enabled
2. Check environment variables are set (MAYTAPI_*)
3. Verify phone number format (+country code)
4. Confirm user has both consent flags set
5. Check provider API credits/limits

### High Error Rate

1. Review error messages in outbox
2. Check external service health
3. Verify authentication credentials
4. Check rate limits aren't being exceeded
5. Consider disabling temporarily and investigating

## 📞 Support

For issues or questions:
1. Check `/admin/integrations` dashboard
2. Review database error logs
3. Check edge function logs in Supabase dashboard
4. Contact technical support with specific error IDs

---

**Deployment Date**: 2025-10-16  
**Version**: LAV #17  
**Status**: ✅ CRM Enabled (Pilot) | ⏸️ WhatsApp Disabled (Pending)
