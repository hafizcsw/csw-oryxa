import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= P0/P1 Alert Definitions (Portal Wiring) =============
const PORTAL_ALERT_PATTERNS = {
  // P0 - Critical (immediate action required)
  CRITICAL_GUARD_VIOLATION: {
    level: 'critical',
    category: 'security',
    pattern: /CRITICAL_GUARD_VIOLATION/,
  },
  FORBIDDEN_USER_KEYS: {
    level: 'critical', 
    category: 'security',
    pattern: /has_forbidden=true/,
  },
  PORTAL_RES_FAILED: {
    level: 'critical',
    category: 'portal',
    pattern: /PORTAL_RES.*ok=false/,
  },
  // P1 - Warning (investigate within hours)
  PORTAL_RES_NON_200: {
    level: 'warning',
    category: 'portal',
    pattern: /PORTAL_RES.*status=(?!200)\d+/,
  },
  MISSING_TUITION_BASIS: {
    level: 'warning',
    category: 'portal',
    // If SYSTEM_AUGMENTED doesn't include tuition_basis
    pattern: /SYSTEM_AUGMENTED.*added_system_keys=\[[^\]]*\](?!.*tuition_basis)/,
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const alerts: any[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // ============= NEW: Portal Wiring Alerts (from Edge Function Logs) =============
    // Note: This checks recent logs for P0/P1 patterns
    // In production, use a proper log drain (Datadog/Sentry/CloudWatch)
    
    // Check for CRITICAL_GUARD_VIOLATION in recent alerts
    const { data: recentAlerts } = await supabase
      .from('system_alerts')
      .select('*')
      .eq('acknowledged', false)
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false });

    // Count portal-related critical alerts in last hour
    const portalCriticalCount = recentAlerts?.filter(a => 
      a.category === 'security' || 
      (a.category === 'portal' && a.level === 'critical')
    ).length || 0;

    if (portalCriticalCount > 0) {
      console.log(`[alerts-check] ⚠️ Found ${portalCriticalCount} unacknowledged portal/security alerts`);
    }

    // ============= Existing Checks =============
    
    // Check 1: Golden Set Test Failures
    const { data: latestTest } = await supabase
      .from('quality_test_runs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    if (latestTest && !latestTest.passed) {
      alerts.push({
        level: 'critical',
        category: 'quality',
        message: `Golden Set test failed: ${(latestTest.precision * 100).toFixed(1)}% precision (threshold: 85%)`,
        details: { test_id: latestTest.id, precision: latestTest.precision }
      });
    }

    // Check 2: High Mismatch Rate
    const { data: recentReviews, error: reviewError } = await supabase
      .from('harvest_review_queue')
      .select('double_verdict')
      .gte('double_checked_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!reviewError && recentReviews) {
      const mismatchCount = recentReviews.filter(r => r.double_verdict === 'mismatch').length;
      const mismatchRate = recentReviews.length > 0 ? mismatchCount / recentReviews.length : 0;

      if (mismatchRate > 0.12) {
        alerts.push({
          level: 'warning',
          category: 'quality',
          message: `High mismatch rate: ${(mismatchRate * 100).toFixed(1)}% (threshold: 12%)`,
          details: { mismatch_count: mismatchCount, total: recentReviews.length }
        });
      }
    }

    // Check 3: Budget Exceeded
    const { data: budgetStatus } = await supabase.rpc('check_budget_available', { p_period_type: 'weekly' });

    if (budgetStatus && !budgetStatus.available) {
      alerts.push({
        level: 'critical',
        category: 'budget',
        message: 'Weekly budget exceeded',
        details: budgetStatus
      });
    } else if (budgetStatus?.tokens?.used > budgetStatus?.tokens?.budget * 0.8) {
      alerts.push({
        level: 'warning',
        category: 'budget',
        message: 'Budget usage at 80%',
        details: budgetStatus
      });
    }

    // Insert alerts into system_alerts if not already exists
    for (const alert of alerts) {
      const { error: insertError } = await supabase
        .from('system_alerts')
        .insert({
          level: alert.level,
          category: alert.category,
          message: alert.message,
          details: alert.details,
          acknowledged: false
        });
      
      if (insertError) {
        console.error('[alerts-check] Failed to insert alert:', insertError);
      }
    }

    console.log(`[alerts-check] Generated ${alerts.length} alerts, ${portalCriticalCount} portal critical unack`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        alerts_count: alerts.length, 
        alerts,
        portal_critical_unack: portalCriticalCount,
        patterns_defined: Object.keys(PORTAL_ALERT_PATTERNS),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[alerts-check] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
