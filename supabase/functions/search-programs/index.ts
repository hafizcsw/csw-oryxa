import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/auth.ts';

console.log('[search-programs] VERSION=2026-02-09_door6_full_hard16');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const HARD16_KEYS = new Set([
  'country_code', 'city', 'degree_slug', 'discipline_slug', 'study_mode', 'instruction_languages',
  'tuition_usd_min', 'tuition_usd_max', 'duration_months_max', 'has_dorm', 'dorm_price_monthly_usd_max',
  'monthly_living_usd_max', 'scholarship_available', 'scholarship_type', 'intake_months', 'deadline_before',
]);
const RANK10_KEYS = new Set([
  'institution_id', 'ranking_system', 'ranking_year', 'world_rank_max', 'national_rank_max',
  'overall_score_min', 'teaching_score_min', 'employability_score_min', 'academic_reputation_score_min', 'research_score_min',
]);
const MAPPABLE_RANK10_KEYS = new Set(['institution_id', 'world_rank_max', 'national_rank_max']);
const KEYWORD_KEYS = new Set(['keyword']);
const TOP_LEVEL_STRUCTURED_KEYS = new Set(['params', 'rank_filters', 'filters_hash', 'limit', 'page', 'student_portal_token']);
const STRUCTURED_ALLOWED_PARAMS = new Set([...HARD16_KEYS, 'keyword']);
const LOCKED_KEYS = new Set(['is_active', 'partner_priority', 'do_not_offer', 'tuition_basis']);
const LEGACY_ALIAS_KEYS = ['country_slug', 'country', 'degree_id', 'subject', 'fees_max', 'max_tuition', 'degree_level', 'language', 'tuition_max_year_usd', 'q', 'query'];

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return i > 0 ? i : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function normalizePayload(body: Record<string, any>) {
  const hasStructured = typeof body?.params === 'object' || typeof body?.rank_filters === 'object';
  const params = hasStructured ? (body.params || {}) : body;
  const rank_filters = hasStructured ? (body.rank_filters || {}) : {};
  const limitRaw = toPositiveInt(body?.limit ?? params?.limit, 20);
  const pageRaw = toPositiveInt(body?.page ?? params?.page, 1);
  const limit = clamp(limitRaw, 1, 100);
  const page = clamp(pageRaw, 1, 10000);
  const offset = (page - 1) * limit;
  return { hasStructured, params, rank_filters, limit, page, offset };
}

function etagFor(body: unknown) {
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  let h = 0, i = 0, len = s.length;
  while (i < len) h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
  return `W/"${h}"`;
}

Deno.serve(async (req) => {
  const t0 = performance.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: Record<string, any>;
    try {
      const rawText = await req.text();
      if (!rawText || !rawText.trim()) {
        return new Response(
          JSON.stringify({ ok: false, error: 'empty_request_body', items: [], count: 0 }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      body = JSON.parse(rawText);
    } catch (parseErr) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_json_body', items: [], count: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const headerStudentPortalToken = req.headers.get('x-student-portal-token');
    const effectiveStudentPortalToken = headerStudentPortalToken
      || (typeof body?.student_portal_token === 'string' && body.student_portal_token ? body.student_portal_token : undefined);
    const reqETag = req.headers.get('if-none-match');
    if (effectiveStudentPortalToken && effectiveStudentPortalToken.length < 10) {
      // Ignore malformed token; search endpoint supports guest mode
    }
    const tag = etagFor(body);

    if (reqETag === tag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          ETag: tag,
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    const { hasStructured, params, rank_filters, limit, page, offset } = normalizePayload(body);

    const blockedTopLevel = hasStructured
      ? Object.keys(body).filter((k) => !TOP_LEVEL_STRUCTURED_KEYS.has(k))
      : [];

    const blockedParamKeys = Object.keys(params || {}).filter((k) => {
      if (LOCKED_KEYS.has(k)) return true;
      if (hasStructured) return !STRUCTURED_ALLOWED_PARAMS.has(k);
      if (k === 'limit' || k === 'offset' || k === 'page' || k === 'page_size') return false;
      return !HARD16_KEYS.has(k) && !KEYWORD_KEYS.has(k) && !LEGACY_ALIAS_KEYS.includes(k);
    });

    const blockedRankKeys = Object.keys(rank_filters || {}).filter((k) => {
      if (LOCKED_KEYS.has(k)) return true;
      if (!RANK10_KEYS.has(k)) return true;
      if (hasStructured && !MAPPABLE_RANK10_KEYS.has(k)) return true;
      return false;
    });

    if (blockedTopLevel.length > 0 || blockedParamKeys.length > 0 || blockedRankKeys.length > 0) {
      const blocked = [
        ...blockedTopLevel.map((k) => `top:${k}`),
        ...blockedParamKeys.map((k) => `params:${k}`),
        ...blockedRankKeys.map((k) => `rank:${k}`),
      ];
      return new Response(
        JSON.stringify({ ok: false, error: 'unsupported_filters', blocked_filters: blocked }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const {
      country_slug = null,
      country = null,
      country_code = null,
      degree_id = null,
      degree_slug = null,
      subject = null,
      keyword = null,
      q = null,
      query: query_alias = null,
      city = null,
      discipline_slug = null,
      study_mode = null,
      instruction_languages = null,
      tuition_usd_min = null,
      tuition_usd_max = null,
      duration_months_max = null,
      has_dorm = null,
      dorm_price_monthly_usd_max = null,
      monthly_living_usd_max = null,
      scholarship_available = null,
      scholarship_type = null,
      intake_months = null,
      deadline_before = null,
      fees_max = null,
      max_tuition = null,
    } = params || {};

    const { institution_id = null, world_rank_max = null, national_rank_max = null } = rank_filters || {};

    const countryFilter = hasStructured ? country_code : (country_code || country_slug || country);
    const degreeFilter = hasStructured ? degree_slug : (degree_id || degree_slug);
    const keywordFilter = hasStructured ? keyword : (keyword || subject || q || query_alias);
    const feesFilter = hasStructured ? tuition_usd_max : (fees_max || max_tuition);

    let dbQuery = supabase
      .from('vw_program_search_api_v3_final')
      .select(`
        program_id, program_name_ar, program_name_en,
        duration_months, instruction_languages, study_mode,
        university_id, university_name_ar, university_name_en, university_logo, city,
        tuition_usd_year_min, tuition_usd_year_max, tuition_is_free,
        monthly_living_usd, ranking, currency_code,
        country_code, country_name_ar, country_name_en,
        degree_slug, degree_name, discipline_slug, discipline_name_ar, discipline_name_en,
        is_active, publish_status, portal_url,
        has_dorm, dorm_price_monthly_usd,
        scholarship_available, scholarship_type,
        partner_tier, partner_preferred, partner_star,
        intake_months, deadline_date, do_not_offer
      `, { count: 'exact' })
      .eq('is_active', true)
      .eq('publish_status', 'published')
      .eq('do_not_offer', false);

    if (countryFilter) {
      if (String(countryFilter).length === 2) {
        dbQuery = dbQuery.eq('country_code', String(countryFilter).toUpperCase());
      } else {
        dbQuery = dbQuery.or(`country_code.eq.${String(countryFilter).toUpperCase()},country_name_en.ilike.%${countryFilter}%`);
      }
    }
    if (city) dbQuery = dbQuery.ilike('city', `%${String(city).trim()}%`);
    if (degreeFilter) dbQuery = dbQuery.eq('degree_slug', degreeFilter);
    if (discipline_slug) dbQuery = dbQuery.eq('discipline_slug', discipline_slug);
    if (study_mode) dbQuery = dbQuery.eq('study_mode', study_mode);

    const instructionLanguages = toStringArray(instruction_languages);
    if (instructionLanguages.length > 0) {
      dbQuery = dbQuery.contains('instruction_languages', instructionLanguages);
    }

    if (keywordFilter) {
      dbQuery = dbQuery.or(`program_name_en.ilike.%${keywordFilter}%,program_name_ar.ilike.%${keywordFilter}%`);
    }

    const tuitionMinValue = toFiniteNumber(tuition_usd_min);
    const tuitionMaxValue = toFiniteNumber(feesFilter);
    const durationMaxValue = toFiniteNumber(duration_months_max);
    const dormPriceMaxValue = toFiniteNumber(dorm_price_monthly_usd_max);
    const livingMaxValue = toFiniteNumber(monthly_living_usd_max);
    const worldRankMaxValue = toFiniteNumber(world_rank_max);
    const nationalRankMaxValue = toFiniteNumber(national_rank_max);

    if (tuitionMinValue !== null) dbQuery = dbQuery.gte('tuition_usd_year_min', tuitionMinValue);
    if (tuitionMaxValue !== null) dbQuery = dbQuery.lte('tuition_usd_year_max', tuitionMaxValue);
    if (durationMaxValue !== null) dbQuery = dbQuery.lte('duration_months', durationMaxValue);

    const hasDormValue = toBooleanOrNull(has_dorm);
    if (hasDormValue !== null) dbQuery = dbQuery.eq('has_dorm', hasDormValue);
    if (dormPriceMaxValue !== null) dbQuery = dbQuery.lte('dorm_price_monthly_usd', dormPriceMaxValue);
    if (livingMaxValue !== null) dbQuery = dbQuery.lte('monthly_living_usd', livingMaxValue);

    const scholarshipAvailableValue = toBooleanOrNull(scholarship_available);
    if (scholarshipAvailableValue !== null) dbQuery = dbQuery.eq('scholarship_available', scholarshipAvailableValue);
    if (scholarship_type) dbQuery = dbQuery.eq('scholarship_type', scholarship_type);

    const intakeMonthsValue = toStringArray(intake_months);
    if (intakeMonthsValue.length > 0) dbQuery = dbQuery.overlaps('intake_months', intakeMonthsValue);
    if (typeof deadline_before === 'string' && deadline_before.trim()) dbQuery = dbQuery.lte('deadline_date', deadline_before);

    if (institution_id) dbQuery = dbQuery.eq('university_id', institution_id);
    if (worldRankMaxValue !== null) dbQuery = dbQuery.lte('ranking', worldRankMaxValue);
    if (nationalRankMaxValue !== null) dbQuery = dbQuery.lte('ranking', nationalRankMaxValue);

    dbQuery = dbQuery
      .order('partner_preferred', { ascending: false, nullsFirst: false })
      .order('ranking', { ascending: true, nullsFirst: true })
      .range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await dbQuery;
    if (error) throw error;

    const items = (data || []).map((p: any) => ({
      program_id: p.program_id,
      program_name: p.program_name_ar,
      duration_months: p.duration_months,
      languages: p.instruction_languages,
      university_id: p.university_id,
      university_name: p.university_name_ar,
      city: p.city,
      logo_url: p.university_logo,
      fees_yearly: p.tuition_usd_year_max,
      monthly_living: p.monthly_living_usd,
      ranking: p.ranking,
      country_slug: p.country_code?.toLowerCase(),
      country_name: p.country_name_ar,
      degree_name: p.degree_name,
      degree_slug: p.degree_slug,
      program_name_ar: p.program_name_ar,
      program_name_en: p.program_name_en,
      university_name_ar: p.university_name_ar,
      university_name_en: p.university_name_en,
      university_logo: p.university_logo,
      country_code: p.country_code,
      country_name_ar: p.country_name_ar,
      country_name_en: p.country_name_en,
      tuition_usd_min: p.tuition_usd_year_min,
      tuition_usd_max: p.tuition_usd_year_max,
      tuition_is_free: p.tuition_is_free,
      currency_code: p.currency_code,
      portal_url: p.portal_url,
      language: p.instruction_languages?.[0] ?? null,
      study_mode: p.study_mode,
      discipline_slug: p.discipline_slug,
      discipline_name_ar: p.discipline_name_ar,
      discipline_name_en: p.discipline_name_en,
      has_dorm: p.has_dorm,
      dorm_price_monthly_usd: p.dorm_price_monthly_usd,
      monthly_living_usd: p.monthly_living_usd,
      scholarship_available: p.scholarship_available,
      scholarship_type: p.scholarship_type,
      partner_tier: p.partner_tier,
      partner_preferred: p.partner_preferred,
      partner_star: p.partner_star,
      intake_months: p.intake_months,
      deadline_date: p.deadline_date,
      instruction_languages: p.instruction_languages,
    }));

    const appliedFilters: Record<string, any> = {
      limit: Number(limit),
      offset: Number(offset),
    };
    const ignoredFilters: string[] = [];

    if (countryFilter) appliedFilters.country_code = countryFilter;
    if (city) appliedFilters.city = String(city).trim();
    if (degreeFilter) appliedFilters.degree_slug = degreeFilter;
    if (discipline_slug) appliedFilters.discipline_slug = discipline_slug;
    if (study_mode) appliedFilters.study_mode = study_mode;
    if (instructionLanguages.length > 0) appliedFilters.instruction_languages = instructionLanguages;
    if (keywordFilter) appliedFilters.keyword = keywordFilter;
    if (tuitionMinValue !== null) appliedFilters.tuition_usd_min = tuitionMinValue;
    if (tuitionMaxValue !== null) appliedFilters.tuition_usd_max = tuitionMaxValue;
    if (durationMaxValue !== null) appliedFilters.duration_months_max = durationMaxValue;
    if (hasDormValue !== null) appliedFilters.has_dorm = hasDormValue;
    if (dormPriceMaxValue !== null) appliedFilters.dorm_price_monthly_usd_max = dormPriceMaxValue;
    if (livingMaxValue !== null) appliedFilters.monthly_living_usd_max = livingMaxValue;
    if (scholarshipAvailableValue !== null) appliedFilters.scholarship_available = scholarshipAvailableValue;
    if (scholarship_type) appliedFilters.scholarship_type = scholarship_type;
    if (intakeMonthsValue.length > 0) appliedFilters.intake_months = intakeMonthsValue;
    if (typeof deadline_before === 'string' && deadline_before.trim()) appliedFilters.deadline_before = deadline_before;
    if (institution_id) appliedFilters.institution_id = institution_id;
    if (worldRankMaxValue !== null) appliedFilters.world_rank_max = worldRankMaxValue;
    if (nationalRankMaxValue !== null) appliedFilters.national_rank_max = nationalRankMaxValue;

    const normalizedFrom: Record<string, string> = {};
    if (!hasStructured) {
      if (params.country_slug && params.country_slug !== countryFilter) normalizedFrom.country_slug = 'country_code';
      if (params.country && params.country !== countryFilter) normalizedFrom.country = 'country_code';
      if (params.degree_id && params.degree_id !== degreeFilter) normalizedFrom.degree_id = 'degree_slug';
      if (params.fees_max && params.fees_max !== feesFilter) normalizedFrom.fees_max = 'tuition_usd_max';
      ignoredFilters.push(...Object.keys(normalizedFrom));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        items,
        count: count || 0,
        total: count || 0,
        has_next: offset + Number(limit) < (count || 0),
        next_offset: offset + items.length,
        sot_view: 'vw_program_search_api_v3_final',
        applied_filters: appliedFilters,
        ignored_filters: ignoredFilters,
        normalized_from: normalizedFrom,
        contract_version: hasStructured ? 'portal_structured_v1' : 'website_v1_public',
        next_page_token: offset + items.length < (count || 0) ? String(page + 1) : null,
        missing_fields: [],
        search_mode: 'start',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ETag: etagFor(body),
          'Cache-Control': 'public, max-age=60',
          'Server-Timing': `db;dur=${Math.round(performance.now() - t0)}`,
        },
        status: 200,
      },
    );
  } catch (error) {
    console.error('[search-programs] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error), items: [], count: 0 }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
