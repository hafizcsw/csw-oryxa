/**
 * orx-evidence-ingest — Controlled writer for orx_evidence table.
 *
 * Security: service-role only (no anon). Validates via getClaims → admin check
 * OR internal service-role header.
 *
 * Supports: single insert, dedupe via content_hash, source metadata
 * normalization, trust/contextual defaults, state machine enforcement.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Source type metadata (mirrors orxMethodology.ts) ──

const SOURCE_TYPE_META: Record<string, { trust_level: string; contextual_only: boolean }> = {
  official_website:   { trust_level: 'high',   contextual_only: false },
  course_catalog:     { trust_level: 'high',   contextual_only: false },
  official_pdf:       { trust_level: 'high',   contextual_only: false },
  structured_data:    { trust_level: 'high',   contextual_only: false },
  government_report:  { trust_level: 'high',   contextual_only: false },
  accreditation_body: { trust_level: 'high',   contextual_only: false },
  verified_student:   { trust_level: 'medium', contextual_only: false },
  third_party_index:  { trust_level: 'medium', contextual_only: true },
  news_press:         { trust_level: 'low',    contextual_only: true },
};

const VALID_ENTITY_TYPES = ['university', 'program', 'country'];
const VALID_LAYERS = ['country', 'university', 'program'];
const VALID_SOURCE_TYPES = Object.keys(SOURCE_TYPE_META);
const VALID_INITIAL_STATES = ['discovered', 'fetched', 'extracted', 'normalized', 'accepted'];

const METHODOLOGY_VERSION = '1.1';

// ── Helpers ──

function extractRegistrableDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (sld.length <= 3 && tld.length <= 3) return parts.slice(-3).join('.');
    return parts.slice(-2).join('.');
  } catch {
    return url;
  }
}

function validatePayload(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  // Required fields
  if (!VALID_ENTITY_TYPES.includes(body.entity_type)) {
    errors.push(`entity_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
  }
  if (!body.entity_id || typeof body.entity_id !== 'string' || body.entity_id.trim().length === 0) {
    errors.push('entity_id is required (non-empty string)');
  }
  if (!VALID_LAYERS.includes(body.layer)) {
    errors.push(`layer must be one of: ${VALID_LAYERS.join(', ')}`);
  }
  if (!body.signal_family || typeof body.signal_family !== 'string') {
    errors.push('signal_family is required');
  }
  if (!VALID_SOURCE_TYPES.includes(body.source_type)) {
    errors.push(`source_type must be one of: ${VALID_SOURCE_TYPES.join(', ')}`);
  }
  if (!body.source_url || typeof body.source_url !== 'string') {
    errors.push('source_url is required');
  } else {
    try { new URL(body.source_url); } catch {
      errors.push('source_url must be a valid URL');
    }
  }
  if (!body.content_hash || typeof body.content_hash !== 'string' || body.content_hash.length < 8) {
    errors.push('content_hash is required (min 8 chars)');
  }

  // Optional but validated
  if (body.observed_at) {
    const d = new Date(body.observed_at);
    if (isNaN(d.getTime())) errors.push('observed_at must be a valid ISO date');
  }
  if (body.freshness_date) {
    const d = new Date(body.freshness_date);
    if (isNaN(d.getTime())) errors.push('freshness_date must be a valid ISO date');
  }
  if (body.evidence_status && !VALID_INITIAL_STATES.includes(body.evidence_status)) {
    errors.push(`evidence_status must be one of: ${VALID_INITIAL_STATES.join(', ')}`);
  }
  if (body.extraction_confidence !== undefined && body.extraction_confidence !== null) {
    const c = Number(body.extraction_confidence);
    if (isNaN(c) || c < 0 || c > 1) errors.push('extraction_confidence must be 0-1');
  }

  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Auth: require service-role or authenticated admin ──
  const authHeader = req.headers.get('Authorization') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Check if caller is using service-role key directly
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isServiceRole) {
    // Fall back to user auth — require admin role
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Check admin role
    const userId = claimsData.claims.sub;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleRow } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Parse & Validate ──
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const validation = validatePayload(body);
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: 'Validation failed', details: validation.errors }), {
      status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Normalize & Derive ──
  const sourceMeta = SOURCE_TYPE_META[body.source_type];
  const sourceDomain = extractRegistrableDomain(body.source_url);

  const row = {
    entity_type: body.entity_type,
    entity_id: body.entity_id.trim(),
    layer: body.layer,
    signal_family: body.signal_family.trim(),
    source_type: body.source_type,
    source_url: body.source_url.trim(),
    source_domain: sourceDomain,
    source_title: body.source_title || null,
    trust_level: body.trust_level || sourceMeta.trust_level,
    contextual_only: body.contextual_only ?? sourceMeta.contextual_only,
    snippet: body.snippet || null,
    language_code: body.language_code || null,
    content_hash: body.content_hash.trim(),
    observed_at: body.observed_at || new Date().toISOString(),
    freshness_date: body.freshness_date || null,
    evidence_status: body.evidence_status || 'discovered',
    extraction_confidence: body.extraction_confidence ?? null,
    rejection_reason: body.rejection_reason || null,
    conflict_group_id: body.conflict_group_id || null,
    methodology_version: METHODOLOGY_VERSION,
  };

  // ── Insert with dedupe (ON CONFLICT → skip) ──
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Check for existing non-terminal evidence with same content_hash + entity
  const { data: existing } = await admin
    .from('orx_evidence')
    .select('id, evidence_status')
    .eq('entity_type', row.entity_type)
    .eq('entity_id', row.entity_id)
    .eq('content_hash', row.content_hash)
    .not('evidence_status', 'in', '("rejected","superseded")')
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({
      outcome: 'duplicate_skipped',
      existing_id: existing.id,
      existing_status: existing.evidence_status,
      message: 'Evidence with identical content_hash already exists for this entity.',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: inserted, error: insertErr } = await admin
    .from('orx_evidence')
    .insert(row)
    .select('id, entity_type, entity_id, evidence_status, content_hash, source_domain, trust_level, contextual_only')
    .single();

  if (insertErr) {
    console.error('orx_evidence insert error:', insertErr);
    return new Response(JSON.stringify({ error: 'Insert failed', detail: insertErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    outcome: 'inserted',
    evidence: inserted,
  }), {
    status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
