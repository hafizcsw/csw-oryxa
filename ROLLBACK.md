# Rollback Plan - LAV University Bot Final Phase

## Quick Rollback (Emergency)

If any critical issues occur during deployment, immediately disable feature flags:

### Critical Flags to Disable First

```sql
-- Disable in this order for immediate safety
UPDATE feature_settings SET value = 'false' WHERE key = 'feature.auto_alerts_enabled';
UPDATE feature_settings SET value = 'false' WHERE key = 'feature.fetch_chain_enabled';
UPDATE feature_settings SET value = 'false' WHERE key = 'feature.price_normalization_enabled';
UPDATE feature_settings SET value = 'false' WHERE key = 'feature.double_validation_enabled';
```

### Via Admin UI

1. Navigate to `/admin/feature-flags`
2. Toggle OFF these flags:
   - `feature.auto_alerts_enabled`
   - `feature.fetch_chain_enabled`
   - `feature.price_normalization_enabled`
   - `feature.double_validation_enabled`

## Rollback Scenarios

### Scenario 1: Fetch Chain Failures

**Symptoms:**
- Fetch success rate drops below 90%
- High rate of "robots_blocked" events
- Increased latency in harvest jobs

**Action:**
```sql
UPDATE feature_settings SET value = 'false' WHERE key = 'feature.fetch_chain_enabled';
```

**Verification:**
- Check `fetch_attempts` table for success rate
- Monitor harvest job completion times
- System reverts to direct fetch method

### Scenario 2: Price Normalization Issues

**Symptoms:**
- Incorrect USD conversions displayed
- Missing price data on program cards
- Exchange rate errors in logs

**Action:**
```sql
UPDATE feature_settings SET value = 'false' WHERE key = 'feature.price_normalization_enabled';
```

**Verification:**
- Programs show original prices (no USD conversion)
- No normalization badges displayed
- Original price data intact

### Scenario 3: Budget Guard Blocks Valid Operations

**Symptoms:**
- Legitimate harvest jobs rejected
- False positive budget alerts
- Operations team cannot proceed with scheduled harvests

**Action:**
```sql
UPDATE feature_settings SET value = 'false' WHERE key = 'feature.harvest_budget_guard_enabled';
-- Optionally increase limits
UPDATE budget_limits SET max_tokens = max_tokens * 2 WHERE period_type = 'daily';
```

**Verification:**
- Harvest jobs proceed normally
- No budget rejection events
- Budget dashboard shows disabled state

### Scenario 4: Alert Flood

**Symptoms:**
- Dozens of alerts per hour
- Alert badge shows critical count >50
- Operations team overwhelmed

**Action:**
```sql
UPDATE feature_settings SET value = 'false' WHERE key = 'feature.auto_alerts_enabled';
-- Mark all current alerts as acknowledged
UPDATE system_alerts SET acknowledged = true WHERE created_at > now() - interval '24 hours';
```

**Verification:**
- No new automatic alerts generated
- Existing alerts marked as acknowledged
- Manual alert creation still works

### Scenario 5: Double Validation Performance Issues

**Symptoms:**
- Review queue processing slows significantly
- High API costs from validation calls
- Timeout errors in validation runs

**Action:**
```sql
UPDATE feature_settings SET value = 'false' WHERE key = 'feature.double_validation_enabled';
```

**Verification:**
- Auto-approval proceeds without double validation
- Review queue processes normally
- Validation runs table no longer grows

## Country-Specific Rollback

If issues occur in specific countries:

```sql
-- Disable feature for Germany only
UPDATE feature_rollout 
SET enabled = false 
WHERE country_code = 'DE' 
  AND feature_key = 'feature.fetch_chain_enabled';
```

## Full System Restore

### Disable ALL New Features

```sql
-- Turn off everything
UPDATE feature_settings SET value = 'false' WHERE key LIKE 'feature.%';

-- Disable all country rollouts
UPDATE feature_rollout SET enabled = false;
```

### Verify Old System Works

1. Test harvest workflow: Create → Review → Approve → Publish
2. Check program search returns results
3. Verify price display (original amounts)
4. Confirm admin UI loads without errors

## Post-Rollback Checklist

- [ ] All feature flags confirmed OFF
- [ ] No critical alerts in system
- [ ] Harvest jobs completing successfully
- [ ] Program search functioning
- [ ] Price display correct (pre-normalization)
- [ ] Admin dashboard accessible
- [ ] Review queue processing
- [ ] No error spike in logs

## Recovery Steps (After Rollback)

1. **Identify Root Cause**
   - Check edge function logs
   - Review telemetry events
   - Analyze error patterns

2. **Fix Issues**
   - Apply necessary patches
   - Test in staging environment
   - Validate with small dataset

3. **Gradual Re-enable**
   - Start with least critical feature
   - Enable for DE country only
   - Monitor for 24 hours
   - Proceed to next feature if stable

## Contact & Escalation

For critical issues requiring immediate attention:

1. Disable affected feature flags immediately
2. Document symptoms and actions taken
3. Review recent events in `events` table
4. Check edge function logs for errors
5. Coordinate with team before re-enabling

## Monitoring During Rollback

```sql
-- Check system health
SELECT * FROM get_system_health_v2();

-- View recent errors
SELECT name, properties, created_at 
FROM events 
WHERE name LIKE '%error%' 
ORDER BY created_at DESC 
LIMIT 50;

-- Check harvest status
SELECT status, COUNT(*) 
FROM harvest_jobs 
WHERE created_at > now() - interval '1 hour'
GROUP BY status;
```
