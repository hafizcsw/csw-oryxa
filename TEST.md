# Testing Guide - LAV University Bot Final Phase

## Pre-Deployment Tests

### 1. Database Migration Verification

```sql
-- Verify all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'feature_settings',
  'exchange_rates', 
  'harvest_costs',
  'budget_limits',
  'logo_licenses',
  'ai_validation_runs',
  'feature_rollout',
  'seo_cron_jobs'
);

-- Verify feature flags are OFF
SELECT key, value FROM feature_settings WHERE key LIKE 'feature.%';
-- All should show 'false'

-- Verify budget limits exist
SELECT * FROM budget_limits;
-- Should show daily and weekly limits
```

### 2. Edge Functions Deployment

Check all new functions are deployed:
- `harvest-fetch-smart`
- `golden-set-test`
- `alerts-check`
- `budget-check`
- `freshness-update`
- `prices-staleness-scan`
- `prices-accept`
- `quality-tests-list`
- `system-alerts-list`

## Phase 1: Fetch Chain Testing (DE Only)

### Enable Feature

```sql
UPDATE feature_settings SET value = 'true' WHERE key = 'feature.fetch_chain_enabled';
UPDATE feature_rollout SET enabled = true WHERE country_code = 'DE' AND feature_key = 'feature.fetch_chain_enabled';
```

### Test Cases

#### Test 1.1: Direct Fetch Success
1. Navigate to Admin → Harvest Studio
2. Add test URL: `https://www.tu-berlin.de/en/studying/study-programs/`
3. Trigger fetch
4. **Expected:** Success status, content extracted, logged in `fetch_attempts` with provider='direct'

#### Test 1.2: Robots.txt Blocking
1. Add URL known to block crawlers
2. Trigger fetch
3. **Expected:** 
   - Status shows "Blocked by robots.txt"
   - Event `robots_blocked` logged
   - No actual fetch attempt made

#### Test 1.3: Provider Fallback
1. Add URL from site with heavy rate limiting
2. Trigger fetch
3. **Expected:**
   - First provider fails or times out
   - System tries next provider
   - Eventually succeeds or logs all failures
   - `fetch_attempts` shows multiple entries

### Success Criteria
- ✅ Fetch success rate ≥95% over 24 hours
- ✅ No robots.txt violations logged
- ✅ Average latency <10 seconds per fetch
- ✅ Provider fallback works correctly

## Phase 2: Price Normalization Testing

### Enable Feature

```sql
UPDATE feature_settings SET value = 'true' WHERE key = 'feature.price_normalization_enabled';
```

### Test Cases

#### Test 2.1: EUR to USD Conversion
1. Create/edit program with tuition: "€1,500 per semester"
2. Save and view program card
3. **Expected:**
   - Original: "€1,500 per semester"
   - Normalized: "~$3,240 per year" (using exchange rate)
   - Tooltip shows calculation details

#### Test 2.2: Multiple Period Formats
Test these inputs:
- "£9,250 per year" → Should show USD equivalent
- "¥1,200,000 per semester" → Convert to annual USD
- "C$15,000 total" → Show USD with period clarification

3. **Expected:** All show both original and USD/annual equivalent

#### Test 2.3: Invalid/Missing Data
1. Program with no price data
2. Program with price but no currency
3. **Expected:**
   - No normalization badge shown
   - Original data displayed
   - No errors in console

### Success Criteria
- ✅ 100% of published programs show original price
- ✅ USD/annual shown when normalization possible
- ✅ Exchange rates within 5% of current rates
- ✅ Source and verified_at timestamp visible

## Phase 3: Golden Set Testing

### Enable Feature

```sql
UPDATE feature_settings SET value = 'true' WHERE key = 'feature.golden_set_enabled';
```

### Test Cases

#### Test 3.1: Run Golden Set Test
1. Navigate to Admin → Data Quality
2. Click "Run Quality Test"
3. **Expected:**
   - Test executes successfully
   - Results show:
     - Precision score (target ≥85%)
     - Recall score (target ≥80%)
     - Total universities tested
     - Correct vs incorrect count
   - Status: PASS or FAIL based on thresholds

#### Test 3.2: Failed Test Alert
1. If test fails (precision <85%):
2. **Expected:**
   - Alert appears in header badge
   - Alert level: 'error'
   - Alert message: "Golden set test failed: Precision X%"
   - Clickable to view details

#### Test 3.3: Historical Trends
1. Run test multiple times (3-5 runs)
2. View Data Quality dashboard
3. **Expected:**
   - Historical log shows all runs
   - Trend indicator (up/down arrows)
   - Latest result prominently displayed

### Success Criteria
- ✅ Precision ≥85% on first run
- ✅ Recall ≥80% on first run
- ✅ Test completes in <30 seconds
- ✅ Alert triggers if thresholds not met

## Phase 4: Freshness Badges Testing

### Enable Feature

```sql
UPDATE feature_settings SET value = 'true' WHERE key = 'feature.freshness_badges_enabled';
```

### Test Cases

#### Test 4.1: Fresh Data Badge
1. View program verified within last 30 days
2. **Expected:**
   - Green badge: "Fresh" or "حديث"
   - Tooltip shows "Verified X days ago"
   - Freshness score: 85-100

#### Test 4.2: Stale Data Badge
1. View program verified >90 days ago
2. **Expected:**
   - Yellow/orange badge: "Stale" or "قديم نسبياً"
   - Tooltip shows verification date
   - Freshness score: 60-84

#### Test 4.3: Unverified Badge
1. View program never verified or no verified_at
2. **Expected:**
   - Gray badge: "Unverified" or "غير محقق"
   - No tooltip or shows "Not verified"
   - No freshness score

#### Test 4.4: Filter by Freshness
1. In search/programs page, apply filter "Fresh only"
2. **Expected:**
   - Only programs with freshness ≥85 shown
   - Count updates correctly
   - Filter persists on page reload

### Success Criteria
- ✅ Badge appears on all program cards
- ✅ Colors match freshness levels correctly
- ✅ Tooltip information accurate
- ✅ Filter works and persists

## Phase 5: Budget Guard Testing

### Enable Feature

```sql
UPDATE feature_settings SET value = 'true' WHERE key = 'feature.harvest_budget_guard_enabled';
```

### Test Cases

#### Test 5.1: Normal Operation Under Budget
1. Navigate to Admin → Budget Dashboard
2. Verify current usage <80% of limits
3. Trigger harvest job
4. **Expected:**
   - Job proceeds normally
   - Budget dashboard updates with new usage
   - No alerts generated

#### Test 5.2: Warning Alert at 80%
1. Simulate high usage (or wait for natural 80% threshold)
2. **Expected:**
   - Alert appears: "Budget usage at 80%"
   - Alert level: 'warning'
   - Alert badge in header shows count

#### Test 5.3: Hard Limit at 100%
1. Attempt to trigger harvest when budget exhausted
2. **Expected:**
   - Job rejected immediately
   - Error message: "Budget exceeded for period"
   - Event `budget_alert` logged with level 'critical'
   - No actual API calls made

#### Test 5.4: Budget Reset (Daily)
1. Wait for daily period to end or manually reset:
```sql
DELETE FROM budget_limits WHERE period_type = 'daily';
INSERT INTO budget_limits (period_type, max_tokens, max_crawls, max_cost_usd, period_end) 
VALUES ('daily', 1000000, 1000, 100.00, now() + interval '1 day');
```
2. **Expected:**
   - Usage counters reset to 0
   - New period starts
   - Operations resume normally

### Success Criteria
- ✅ Jobs proceed when under budget
- ✅ Warning alert at 80%
- ✅ Hard rejection at 100%
- ✅ Daily reset works automatically

## Phase 6: Auto Alerts Testing

### Enable Feature

```sql
UPDATE feature_settings SET value = 'true' WHERE key = 'feature.auto_alerts_enabled';
```

### Test Cases

#### Test 6.1: Quality Alert Generation
1. Run golden-set-test that fails
2. Wait 5 minutes (alert check interval)
3. **Expected:**
   - Alert created in `system_alerts`
   - Alert badge in header shows count
   - Alert level: 'error'
   - Alert category: 'quality'

#### Test 6.2: Budget Alert Generation
1. Push budget usage to 85%
2. Wait for alert check
3. **Expected:**
   - Alert: "Budget usage high"
   - Alert level: 'warning'
   - Alert category: 'budget'

#### Test 6.3: High Mismatch Rate Alert
1. Simulate high mismatch rate in harvest review queue
2. Run alerts-check function
3. **Expected:**
   - Alert: "High mismatch rate detected"
   - Shows percentage and threshold
   - Alert level: 'warning'

#### Test 6.4: Alert Acknowledgment
1. Click on alert badge
2. View alert popover
3. Click "Acknowledge" on an alert
4. **Expected:**
   - Alert marked as acknowledged
   - Badge count decreases
   - Alert no longer appears in popover

### Success Criteria
- ✅ Alerts generated automatically
- ✅ Badge count accurate
- ✅ Acknowledgment works
- ✅ No alert flood (max 10 new alerts per hour)

## Phase 7: Double Validation Testing (DE Only)

### Enable Feature

```sql
UPDATE feature_settings SET value = 'true' WHERE key = 'feature.double_validation_enabled';
UPDATE feature_rollout SET enabled = true WHERE country_code = 'DE' AND feature_key = 'feature.double_validation_enabled';
```

### Test Cases

#### Test 7.1: Confirmed Validation
1. Auto-approve harvest entry for DE university
2. Wait for double validation to run
3. **Expected:**
   - Entry in `ai_validation_runs` with verdict='confirmed'
   - Score ≥0.8
   - `harvest_review_queue` updated: double_validated=true

#### Test 7.2: Mismatch Detection
1. Auto-approve entry with potentially incorrect data
2. Double validation runs
3. **Expected:**
   - Verdict='mismatch'
   - Score 0.5-0.7
   - Entry returned to manual review queue
   - Alert generated if mismatch rate high

#### Test 7.3: Stale Source Detection
1. Entry with source data >12 months old
2. Double validation runs
3. **Expected:**
   - Verdict='stale'
   - Score 0.3-0.5
   - Flagged for re-harvest

### Success Criteria
- ✅ ≥80% of auto-approved entries confirmed
- ✅ Mismatches detected and returned to review
- ✅ Stale data flagged correctly
- ✅ Validation completes within 30 seconds per entry

## Phase 8: Unified Lifecycle Testing

### Enable Feature

```sql
UPDATE feature_settings SET value = 'true' WHERE key = 'feature.unified_lifecycle_enabled';
```

### Test Cases

#### Test 8.1: State Transitions
Test these transitions:
1. `pending` → `auto_approved`
2. `auto_approved` → `published`
3. `auto_approved` → `manual_review` (if double validation fails)
4. `manual_review` → `rejected`
5. `published` → `stale` (after 180 days)

**Expected:** Each transition logged in events, UI updates immediately

#### Test 8.2: Lifecycle Badge in Studio
1. Open University Studio for any university
2. **Expected:**
   - Status bar shows current lifecycle state
   - State badge color-coded
   - Last updated timestamp
   - Hover shows allowed next states

#### Test 8.3: Bulk State Update
1. Select multiple entries in review queue
2. Bulk action: "Approve All"
3. **Expected:**
   - All states update to 'published'
   - Single event logged with count
   - UI reflects changes immediately

### Success Criteria
- ✅ No invalid state transitions possible
- ✅ All transitions logged
- ✅ UI reflects states correctly
- ✅ Bulk operations work

## Phase 9: Logo License Enforcement

### Enable Feature

```sql
UPDATE feature_settings SET value = 'true' WHERE key = 'feature.logo_license_enforce';
```

### Test Cases

#### Test 9.1: Block Unknown License
1. Attempt to publish university with logo_license='unknown'
2. **Expected:**
   - Publish blocked
   - Error: "Logo license must be verified before publishing"
   - University remains in draft

#### Test 9.2: Allow Official License
1. Set logo_license='official' with source URL
2. Publish university
3. **Expected:**
   - Publish succeeds
   - Logo displays on public pages
   - License info in admin view

#### Test 9.3: License Tracking
1. Upload new logo
2. **Expected:**
   - Prompt to specify license type
   - Required fields: type, source_url
   - Entry created in `logo_licenses` table

### Success Criteria
- ✅ Unknown licenses blocked from publishing
- ✅ Official/verified licenses allowed
- ✅ License info tracked and displayed
- ✅ No logos published without license verification

## Integration Tests

### Full Workflow Test (DE)

1. **Harvest** new German university
2. **Fetch** data using fetch chain (robots.txt check)
3. **Normalize** prices to USD/annual
4. **Auto-approve** based on confidence
5. **Double-validate** with external sources
6. **Apply** freshness badge
7. **Publish** with lifecycle state update
8. **Display** on public search with all enhancements

**Expected:** Complete flow works end-to-end without errors, all features active

### Performance Test

1. Trigger 100 harvest jobs simultaneously
2. **Expected:**
   - Budget guard prevents >daily limit
   - Fetch chain handles load
   - No deadlocks or timeouts
   - All jobs complete or rejected appropriately

## Smoke Test Checklist (Staging)

Before production rollout:

- [ ] All migrations applied successfully
- [ ] All edge functions deployed and responding
- [ ] Feature flags all OFF initially
- [ ] DE country rollout records exist
- [ ] Admin UI loads without errors
- [ ] Enable one feature at a time, test, disable
- [ ] All tests from above pass
- [ ] No error spikes in logs
- [ ] Rollback procedure tested and works

## Production Rollout (Gradual)

### Day 1: DE Only, Fetch Chain + Price Normalization
- Enable for Germany
- Monitor for 24 hours
- Check metrics: fetch success, price display, no errors

### Day 2: DE Only, Add Freshness + Budget
- Enable freshness badges
- Enable budget guard
- Monitor for 24 hours

### Day 3: DE Only, Add Alerts + Validation
- Enable auto alerts
- Enable double validation
- Monitor for 24 hours

### Day 4-7: Expand to GB, NL, ES
- Repeat above for each country
- Monitor closely

### Week 2: Remaining Countries (CA, RU)
- Final rollout
- Enable all features globally

## KPI Monitoring Post-Deployment

Track these metrics daily:

```sql
-- Fetch success rate
SELECT 
  COUNT(CASE WHEN status = 'success' THEN 1 END)::FLOAT / COUNT(*) * 100 as success_rate
FROM fetch_attempts 
WHERE created_at > now() - interval '24 hours';

-- Golden set precision
SELECT precision_score 
FROM quality_test_runs 
ORDER BY run_at DESC LIMIT 1;

-- Budget usage
SELECT * FROM check_budget_available('daily');

-- Stale data percentage
SELECT 
  COUNT(CASE WHEN is_stale THEN 1 END)::FLOAT / COUNT(*) * 100 as stale_pct
FROM price_observations;

-- Alert count
SELECT COUNT(*) 
FROM system_alerts 
WHERE NOT acknowledged 
  AND created_at > now() - interval '24 hours';
```

Target KPIs:
- Fetch success rate: ≥95%
- Golden precision: ≥85%
- Budget usage: <80%
- Stale data: <20%
- Unacknowledged alerts: <5
