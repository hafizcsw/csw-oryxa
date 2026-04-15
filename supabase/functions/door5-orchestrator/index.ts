/**
 * Door5 Server-Side Orchestrator
 * 
 * Called by pg_cron every minute. Reads state from crawl_settings,
 * calls door5-enrich-worker for one batch, and advances phases automatically.
 * 
 * State key: 'd5_orchestrator' in crawl_settings
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STATE_KEY = 'd5_orchestrator';
const WORKER_FN = 'door5-enrich-worker';

// Phase definitions in execution order
const PHASES = [
  { id: 'phase0_index', action: null, fnName: 'door5-crawl-index', body: { limit: 999 }, label: 'فهرسة' },
  { id: 'phase0_match', action: null, fnName: 'door5-crawl-index', body: { phase: 'match', limit: 999 }, label: 'مطابقة' },
  { id: 'phase1', action: undefined, limit: 5, label: 'إثراء' },
  { id: 'phase2_programs', action: 'programs', limit: 10, label: 'قوائم البرامج' },
  { id: 'phase2b_details', action: 'program_details', limit: 8, label: 'تفاصيل البرامج' },
  { id: 'phase2c_employment', action: 'employment', limit: 10, label: 'توظيف' },
  { id: 'phase2d_useful', action: 'useful_info', limit: 10, label: 'معلومات مفيدة' },
  { id: 'phase3_map', action: 'map_programs', limit: 10, label: 'ربط' },
  { id: 'phase4_publish', action: 'publish_programs', limit: 999, label: 'نشر' },
] as const;

interface OrchestratorState {
  active: boolean;
  current_phase: string;
  phase_index: number;
  started_at: string | null;
  last_tick_at: string | null;
  consecutive_zero: number;
  consecutive_errors: number;
  tick_count: number;
  trace_id: string;
  stats: Record<string, number>;
  log: string[];  // Last 50 log lines
}

const DEFAULT_STATE: OrchestratorState = {
  active: false,
  current_phase: 'idle',
  phase_index: 0,
  started_at: null,
  last_tick_at: null,
  consecutive_zero: 0,
  consecutive_errors: 0,
  tick_count: 0,
  trace_id: '',
  stats: {},
  log: [],
};

function addLog(state: OrchestratorState, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  state.log.push(`[${ts}] ${msg}`);
  // Keep last 100 lines
  if (state.log.length > 100) state.log = state.log.slice(-100);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await req.json().catch(() => ({}));
    const command = body?.command; // 'start', 'stop', 'status'

    // Read current state
    const { data: row } = await supabase
      .from('crawl_settings')
      .select('value')
      .eq('key', STATE_KEY)
      .maybeSingle();

    let state: OrchestratorState = row?.value 
      ? { ...DEFAULT_STATE, ...(typeof row.value === 'object' ? row.value as any : {}) }
      : { ...DEFAULT_STATE };

    // Handle commands
    if (command === 'start') {
      state.active = true;
      state.current_phase = 'phase0_index';
      state.phase_index = 0;
      state.started_at = new Date().toISOString();
      state.tick_count = 0;
      state.consecutive_zero = 0;
      state.consecutive_errors = 0;
      state.trace_id = `D5-AUTO-${Date.now()}`;
      state.stats = {};
      state.log = [];
      addLog(state, '🚀 بدء الزحف الآلي');
      await saveState(supabase, state);
      return respond({ ok: true, message: 'Started', state });
    }

    if (command === 'stop') {
      addLog(state, '⏹️ إيقاف الزحف الآلي');
      state.active = false;
      state.current_phase = 'stopped';
      await saveState(supabase, state);
      return respond({ ok: true, message: 'Stopped', state });
    }

    if (command === 'status') {
      return respond({ ok: true, state });
    }

    if (command === 'restart') {
      // Reset all phases_done and restart from scratch
      const { data: resetResult } = await supabase.rpc('rpc_d5_reset_phases');
      
      state.active = true;
      state.current_phase = 'phase0_index';
      state.phase_index = 0;
      state.started_at = new Date().toISOString();
      state.tick_count = 0;
      state.consecutive_zero = 0;
      state.consecutive_errors = 0;
      state.trace_id = `D5-RESTART-${Date.now()}`;
      state.stats = {};
      state.log = [];
      addLog(state, `🔄 إعادة الزحف الكامل — تم مسح ${resetResult?.reset_count ?? '?'} سجل`);
      await saveState(supabase, state);
      return respond({ ok: true, message: 'Restarted', reset: resetResult, state });
    }

    // === CRON TICK: Process one batch ===
    if (!state.active) {
      return respond({ ok: true, message: 'Not active', state });
    }

    // Guard: check if stuck too long (> 5 min since last tick = another instance running)
    if (state.last_tick_at) {
      const elapsed = Date.now() - new Date(state.last_tick_at).getTime();
      if (elapsed < 50_000) { // Less than 50s since last tick — skip (previous still running)
        return respond({ ok: true, message: 'Previous tick still running', state });
      }
    }

    state.last_tick_at = new Date().toISOString();
    state.tick_count++;

    const phaseIdx = state.phase_index;
    if (phaseIdx >= PHASES.length) {
      // All phases done
      addLog(state, '🎉 اكتمل الزحف الآلي!');
      state.active = false;
      state.current_phase = 'done';
      await saveState(supabase, state);
      return respond({ ok: true, message: 'All phases complete', state });
    }

    const phase = PHASES[phaseIdx];
    state.current_phase = phase.id;
    addLog(state, `⚙️ Tick #${state.tick_count} — ${phase.label} (${phase.id})`);

    // Call the appropriate function
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let fnName = WORKER_FN;
    let reqBody: Record<string, unknown> = {};

    if ('fnName' in phase && phase.fnName) {
      // Phase 0 uses a different function
      fnName = phase.fnName;
      reqBody = { ...phase.body };
    } else {
      // Worker phases
      reqBody = { limit: phase.limit };
      if (phase.action !== undefined) {
        reqBody.action = phase.action;
      }
      if (phase.id === 'phase2b_details') {
        reqBody.detail_limit = 50;
      }
    }

    console.log(`[D5-Orchestrator] Calling ${fnName} with`, JSON.stringify(reqBody));

    const workerResp = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(reqBody),
    });

    if (!workerResp.ok) {
      const errText = await workerResp.text();
      state.consecutive_errors++;
      addLog(state, `❌ خطأ HTTP ${workerResp.status}: ${errText.slice(0, 200)}`);
      
      if (state.consecutive_errors >= 5) {
        addLog(state, '🛑 توقف: 5 أخطاء متتالية');
        state.active = false;
        state.current_phase = 'error';
      }
      await saveState(supabase, state);
      return respond({ ok: false, error: errText.slice(0, 200), state });
    }

    state.consecutive_errors = 0;
    const result = await workerResp.json();

    // Check if phase is complete
    const isPhase0 = phase.id.startsWith('phase0');
    
    if (isPhase0) {
      // Phase 0 is single-shot (index then match)
      const summary = phase.id === 'phase0_index'
        ? `بذور: ${result.total_seeds ?? 0}, Upserted: ${result.upserted ?? 0}`
        : `مطابقة: ${result.total_matched ?? 0}, جديد: ${result.matched ?? 0}`;
      addLog(state, `✅ ${phase.label}: ${summary}`);
      
      // Merge stats
      for (const key of Object.keys(result)) {
        if (typeof result[key] === 'number') {
          state.stats[`${phase.id}_${key}`] = result[key];
        }
      }
      
      // Advance to next phase
      state.phase_index++;
      state.consecutive_zero = 0;
      await saveState(supabase, state);
      return respond({ ok: true, phase: phase.id, result, state });
    }

    // Worker phases: check if done
    const noTargets = result.message === 'No targets';
    const processed = result.successful ?? result.total_processed ?? result.total_crawled ?? 0;

    // Merge stats
    for (const key of Object.keys(result)) {
      if (typeof result[key] === 'number') {
        state.stats[`${phase.id}_${key}`] = (state.stats[`${phase.id}_${key}`] || 0) + result[key];
      }
    }

    if (noTargets || (processed === 0 && !result.error)) {
      state.consecutive_zero++;
    } else {
      state.consecutive_zero = 0;
    }

    addLog(state, `${phase.label}: معالجة ${processed}${noTargets ? ' — لا أهداف' : ''}`);

    if (noTargets || state.consecutive_zero >= 2) {
      // Phase complete — advance
      addLog(state, `✅ ${phase.label} اكتمل`);
      state.phase_index++;
      state.consecutive_zero = 0;
    }

    await saveState(supabase, state);
    return respond({ ok: true, phase: phase.id, processed, state });

  } catch (err) {
    console.error('[D5-Orchestrator] Fatal:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function saveState(supabase: ReturnType<typeof getSupabaseAdmin>, state: OrchestratorState) {
  await supabase.from('crawl_settings').upsert({
    key: STATE_KEY,
    value: state as any,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
}

function respond(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
