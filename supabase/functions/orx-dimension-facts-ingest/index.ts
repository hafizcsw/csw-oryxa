/**
 * orx-dimension-facts-ingest — Controlled internal ingestion for ORX 2.0 facts
 *
 * Accepts structured fact payloads, validates against source governance policy,
 * and writes INTERNAL-ONLY facts to orx_dimension_facts.
 *
 * This is NOT the public rollout path. Internal bootstrap only.
 */

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Source Policy Matrix (mirrored from orxSourceGovernance.ts) ──

const SOURCE_POLICY: Record<string, {
  allowed_domains: string[];
  fact_boundaries: string[];
  contextual_only: boolean;
  freshness_window_days: number;
  confidence_modifier: number;
}> = {
  official_website:      { allowed_domains: ['core','living','work_mobility'], fact_boundaries: ['institution','program'], contextual_only: false, freshness_window_days: 365, confidence_modifier: 0 },
  official_pdf:          { allowed_domains: ['core'], fact_boundaries: ['institution','program'], contextual_only: false, freshness_window_days: 540, confidence_modifier: 0 },
  course_catalog:        { allowed_domains: ['core'], fact_boundaries: ['program'], contextual_only: false, freshness_window_days: 365, confidence_modifier: 0.1 },
  government_report:     { allowed_domains: ['core','living','work_mobility','roi'], fact_boundaries: ['country','city'], contextual_only: false, freshness_window_days: 730, confidence_modifier: 0.1 },
  accreditation_body:    { allowed_domains: ['core'], fact_boundaries: ['institution','program'], contextual_only: false, freshness_window_days: 1095, confidence_modifier: 0.15 },
  structured_data:       { allowed_domains: ['core','living','work_mobility','roi'], fact_boundaries: ['country','city','institution','program'], contextual_only: false, freshness_window_days: 365, confidence_modifier: 0.05 },
  labor_statistics:      { allowed_domains: ['work_mobility','roi'], fact_boundaries: ['country'], contextual_only: false, freshness_window_days: 730, confidence_modifier: 0.1 },
  housing_reference:     { allowed_domains: ['living','roi'], fact_boundaries: ['city'], contextual_only: false, freshness_window_days: 180, confidence_modifier: -0.1 },
  city_reference:        { allowed_domains: ['living'], fact_boundaries: ['city'], contextual_only: false, freshness_window_days: 365, confidence_modifier: 0 },
  cost_of_living_index:  { allowed_domains: ['living','roi'], fact_boundaries: ['city','country'], contextual_only: false, freshness_window_days: 365, confidence_modifier: 0.05 },
  visa_immigration_source: { allowed_domains: ['work_mobility'], fact_boundaries: ['country'], contextual_only: false, freshness_window_days: 365, confidence_modifier: 0 },
  alumni_outcome_data:   { allowed_domains: ['work_mobility','roi'], fact_boundaries: ['institution','program'], contextual_only: false, freshness_window_days: 730, confidence_modifier: 0.1 },
  salary_survey:         { allowed_domains: ['roi','work_mobility'], fact_boundaries: ['country','city'], contextual_only: false, freshness_window_days: 365, confidence_modifier: -0.15 },
  employer_survey:       { allowed_domains: ['work_mobility'], fact_boundaries: ['country'], contextual_only: true, freshness_window_days: 365, confidence_modifier: -0.2 },
  third_party_contextual: { allowed_domains: ['core','living','work_mobility'], fact_boundaries: ['country','city','institution'], contextual_only: true, freshness_window_days: 365, confidence_modifier: -0.2 },
  news_press:            { allowed_domains: ['core'], fact_boundaries: ['institution'], contextual_only: true, freshness_window_days: 180, confidence_modifier: -0.3 },
  verified_student:      { allowed_domains: ['core','living'], fact_boundaries: ['institution','program'], contextual_only: true, freshness_window_days: 365, confidence_modifier: -0.1 },
};

// ── Valid fact families ──

const VALID_FAMILIES: Record<string, string> = {
  // Living
  housing_availability: 'living',
  housing_affordability: 'living',
  housing_quality: 'living',
  transport_access: 'living',
  student_support: 'living',
  city_safety_context: 'living',
  // Work & Mobility
  work_during_study_rights: 'work_mobility',
  weekly_work_cap: 'work_mobility',
  post_study_work_pathway: 'work_mobility',
  sponsorship_environment: 'work_mobility',
  degree_recognition_context: 'work_mobility',
  language_barrier_context: 'work_mobility',
  // ROI
  tuition_band: 'roi',
  living_cost_band: 'roi',
  scholarship_availability: 'roi',
  cost_pressure_context: 'roi',
  earning_offset_context: 'roi',
};

const VALID_BOUNDARIES = ['country', 'city', 'institution', 'program'];
const VALID_DOMAINS = ['core', 'living', 'work_mobility', 'roi', 'fit'];
const BLOCKED_STATUSES = ['published']; // Cannot directly publish

interface FactPayload {
  boundary_type: string;
  entity_type: string;
  entity_id: string;
  dimension_domain: string;
  fact_family: string;
  fact_key: string;
  fact_value: Record<string, unknown>;
  display_text?: string | null;
  source_url?: string | null;
  source_domain?: string | null;
  source_family: string;
  source_type?: string | null;
  confidence?: number | null;
  coverage_score?: number | null;
  comparability_score?: number | null;
  sparsity_flag?: boolean;
  regional_bias_flag?: boolean;
  freshness_date?: string | null;
  status?: string;
  methodology_version?: string;
}

function validatePayload(fact: FactPayload): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!fact.boundary_type || !fact.entity_type || !fact.entity_id) {
    errors.push('Missing required: boundary_type, entity_type, entity_id');
  }
  if (!fact.dimension_domain || !fact.fact_family || !fact.fact_key) {
    errors.push('Missing required: dimension_domain, fact_family, fact_key');
  }
  if (!fact.source_family) {
    errors.push('Missing required: source_family');
  }

  if (errors.length > 0) return { valid: false, errors, warnings };

  // Boundary
  if (!VALID_BOUNDARIES.includes(fact.boundary_type)) {
    errors.push(`Invalid boundary_type: "${fact.boundary_type}"`);
  }

  // Domain
  if (!VALID_DOMAINS.includes(fact.dimension_domain)) {
    errors.push(`Invalid dimension_domain: "${fact.dimension_domain}"`);
  }

  // Fact family
  if (!(fact.fact_family in VALID_FAMILIES)) {
    errors.push(`Unknown fact_family: "${fact.fact_family}"`);
  } else {
    const expectedDomain = VALID_FAMILIES[fact.fact_family];
    if (expectedDomain !== fact.dimension_domain) {
      errors.push(`Dimension mismatch: "${fact.fact_family}" belongs to "${expectedDomain}" not "${fact.dimension_domain}"`);
    }
  }

  // Source policy enforcement
  const policy = SOURCE_POLICY[fact.source_family];
  if (!policy) {
    errors.push(`Unknown source_family: "${fact.source_family}". No governance policy.`);
  } else {
    if (!policy.allowed_domains.includes(fact.dimension_domain)) {
      errors.push(`Source "${fact.source_family}" not allowed for domain "${fact.dimension_domain}"`);
    }
    if (!policy.fact_boundaries.includes(fact.boundary_type)) {
      errors.push(`Source "${fact.source_family}" not allowed for boundary "${fact.boundary_type}"`);
    }
    if (policy.contextual_only) {
      warnings.push(`Source "${fact.source_family}" is contextual-only`);
    }
  }

  // Status check
  if (fact.status && BLOCKED_STATUSES.includes(fact.status)) {
    errors.push(`Cannot directly insert as "${fact.status}". Use candidate or internal_approved.`);
  }

  // Range checks
  if (fact.confidence != null && (fact.confidence < 0 || fact.confidence > 100)) {
    errors.push(`Confidence must be 0-100, got ${fact.confidence}`);
  }
  if (fact.coverage_score != null && (fact.coverage_score < 0 || fact.coverage_score > 100)) {
    errors.push(`Coverage score must be 0-100`);
  }
  if (fact.comparability_score != null && (fact.comparability_score < 0 || fact.comparability_score > 100)) {
    errors.push(`Comparability score must be 0-100`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require service role or valid admin JWT
    const authHeader = req.headers.get('authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const facts: FactPayload[] = Array.isArray(body.facts) ? body.facts : [body];

    if (facts.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'No facts provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (facts.length > 50) {
      return new Response(JSON.stringify({ ok: false, error: 'Max 50 facts per batch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{
      index: number;
      fact_key: string;
      accepted: boolean;
      errors: string[];
      warnings: string[];
      id?: string;
    }> = [];

    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      const validation = validatePayload(fact);

      if (!validation.valid) {
        results.push({
          index: i,
          fact_key: fact.fact_key || '(unknown)',
          accepted: false,
          errors: validation.errors,
          warnings: validation.warnings,
        });
        continue;
      }

      // Insert with upsert on unique constraint
      const row = {
        boundary_type: fact.boundary_type,
        entity_type: fact.entity_type,
        entity_id: fact.entity_id,
        dimension_domain: fact.dimension_domain,
        fact_family: fact.fact_family,
        fact_key: fact.fact_key,
        fact_value: fact.fact_value || {},
        display_text: fact.display_text || null,
        source_url: fact.source_url || null,
        source_domain: fact.source_domain || null,
        source_family: fact.source_family,
        source_type: fact.source_type || null,
        confidence: fact.confidence ?? null,
        coverage_score: fact.coverage_score ?? null,
        comparability_score: fact.comparability_score ?? null,
        sparsity_flag: fact.sparsity_flag ?? false,
        regional_bias_flag: fact.regional_bias_flag ?? false,
        freshness_date: fact.freshness_date || null,
        status: fact.status || 'candidate',
        methodology_version: fact.methodology_version || 'v2.0',
        last_seen_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('orx_dimension_facts')
        .upsert(row, {
          onConflict: 'entity_type,entity_id,dimension_domain,fact_family,fact_key',
        })
        .select('id')
        .single();

      if (error) {
        results.push({
          index: i,
          fact_key: fact.fact_key,
          accepted: false,
          errors: [`DB error: ${error.message}`],
          warnings: validation.warnings,
        });
      } else {
        results.push({
          index: i,
          fact_key: fact.fact_key,
          accepted: true,
          errors: [],
          warnings: validation.warnings,
          id: data?.id,
        });
      }
    }

    const accepted = results.filter(r => r.accepted).length;
    const rejected = results.filter(r => !r.accepted).length;

    return new Response(
      JSON.stringify({
        ok: true,
        summary: { total: facts.length, accepted, rejected },
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
