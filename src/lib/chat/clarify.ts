import { ALL_ALLOWED_KEYS } from '@/lib/chat/contracts/filters';

const FORBIDDEN_FILTER_KEYS = new Set([
  'q',
  'query',
  'keywords',
  'keyword',
  'is_active',
  'partner_priority',
  'do_not_offer',
  'tuition_basis',
]);

const ALLOWED_FILTER_KEYS = new Set([
  ...ALL_ALLOWED_KEYS,
]);

export type ClarifyFilters = {
  country_code?: string;
  city?: string;
  degree_slug?: string;
  discipline_slug?: string;
  study_mode?: string;
  instruction_languages?: string[];
  tuition_usd_min?: number;
  tuition_usd_max?: number;
  duration_months_max?: number;
  has_dorm?: boolean;
  dorm_price_monthly_usd_max?: number;
  monthly_living_usd_max?: number;
  scholarship_available?: boolean;
  scholarship_type?: string;
  intake_months?: number[];
  deadline_before?: string;
  institution_id?: string;
  ranking_system?: string;
  ranking_year?: number;
  world_rank_max?: number;
  national_rank_max?: number;
  overall_score_min?: number;
  teaching_score_min?: number;
  employability_score_min?: number;
  academic_reputation_score_min?: number;
  research_score_min?: number;
};

const NUMBER_KEYS = new Set<keyof ClarifyFilters>([
  'tuition_usd_min',
  'tuition_usd_max',
  'duration_months_max',
  'dorm_price_monthly_usd_max',
  'monthly_living_usd_max',
  'world_rank_max',
  'national_rank_max',
  'overall_score_min',
  'teaching_score_min',
  'employability_score_min',
  'academic_reputation_score_min',
  'research_score_min',
  'ranking_year',
]);

const BOOLEAN_KEYS = new Set<keyof ClarifyFilters>([
  'has_dorm',
  'scholarship_available',
]);

const STRING_KEYS = new Set<keyof ClarifyFilters>([
  'city',
  'study_mode',
  'scholarship_type',
  'ranking_system',
  'institution_id',
  'discipline_slug',
  'degree_slug',
]);


const SLUG_KEYS = new Set<keyof ClarifyFilters>([
  'discipline_slug',
  'degree_slug',
]);

const COUNTRY_CODE_REGEX = /^[A-Za-z]{2}$/;
const SLUG_REGEX = /^[a-z0-9-]+$/;

export function shouldAttachClarifyFilters(input: {
  hasExplicitFilters: boolean;
  sessionFilters: ClarifyFilters | undefined;
  isAwaitingConsent: boolean;
  isHoldState: boolean;
}): boolean {
  const hasSessionFilters = hasFilters(input.sessionFilters);
  const shouldAutoAttach = hasSessionFilters && (input.isAwaitingConsent || input.isHoldState);
  return input.hasExplicitFilters || shouldAutoAttach;
}

function parseBoolean(rawValue: string): boolean | undefined {
  const normalized = rawValue.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return undefined;
}

function parseNumber(key: keyof ClarifyFilters, rawValue: string): number | undefined {
  const value = rawValue.trim();
  if (key === 'ranking_year') {
    if (!/^\d+$/.test(value)) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1900 || parsed > 2100) return undefined;
    return parsed;
  }
  if (!/^\d+(\.\d+)?$/.test(value)) return undefined;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseIntakeMonths(rawValue: string): number[] {
  return Array.from(new Set(
    rawValue
      .split(',')
      .map((month) => Number.parseInt(month.trim(), 10))
      .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
  ));
}

function isValidIsoDate(rawValue: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return false;
  const [year, month, day] = rawValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function getMissingFields(payload: Record<string, unknown>): string[] {
  const rootMissing = payload.missing_fields;
  const uiDirectives = payload.ui_directives as Record<string, unknown> | undefined;
  const directivesMissing = uiDirectives?.missing_fields;

  const source = Array.isArray(rootMissing)
    ? rootMissing
    : Array.isArray(directivesMissing)
      ? directivesMissing
      : [];

  const objectSource = (!Array.isArray(rootMissing) && rootMissing && typeof rootMissing === 'object')
    ? Object.keys(rootMissing as Record<string, unknown>)
    : (!Array.isArray(directivesMissing) && directivesMissing && typeof directivesMissing === 'object')
      ? Object.keys(directivesMissing as Record<string, unknown>)
      : [];

  return [...source, ...objectSource]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

export function hasControlPayload(payload: Record<string, unknown>): boolean {
  const replyKey = payload.reply_key;
  const phase = payload.phase;
  const uiDirectives = payload.ui_directives;
  const uiDirectivesCamel = payload.uiDirectives;
  const missingFields = payload.missing_fields;
  const missingFieldsCamel = payload.missingFields;
  const cardsJson = payload.cards_json;
  const cardsJsonCamel = payload.cardsJson;
  const cardsQuery = payload.cards_query;
  const cardsQueryCamel = payload.cardsQuery;

  return Boolean(
    (typeof replyKey === 'string' && replyKey.trim()) ||
    (typeof phase === 'string' && phase.trim()) ||
    (uiDirectives && typeof uiDirectives === 'object') ||
    (uiDirectivesCamel && typeof uiDirectivesCamel === 'object') ||
    (Array.isArray(missingFields) && missingFields.length > 0) ||
    (Array.isArray(missingFieldsCamel) && missingFieldsCamel.length > 0) ||
    (missingFields && typeof missingFields === 'object' && !Array.isArray(missingFields)) ||
    (missingFieldsCamel && typeof missingFieldsCamel === 'object' && !Array.isArray(missingFieldsCamel)) ||
    (cardsJson && typeof cardsJson === 'object') ||
    (cardsJsonCamel && typeof cardsJsonCamel === 'object') ||
    (cardsQuery && typeof cardsQuery === 'object') ||
    (cardsQueryCamel && typeof cardsQueryCamel === 'object')
  );
}

export function shouldShowEmptyResponseFallback(input: {
  payload: Record<string, unknown>;
  rawMessageCount: number;
  incomingMessageCount: number;
}): boolean {
  const { payload, rawMessageCount, incomingMessageCount } = input;
  if (rawMessageCount === 0) return false;
  if (incomingMessageCount > 0) return false;
  return !hasControlPayload(payload);
}

export function getClarifyFields(payload: Record<string, unknown>): string[] {
  const missingFields = getMissingFields(payload);
  const replyKey = typeof payload.reply_key === 'string' ? payload.reply_key : '';

  if (replyKey.startsWith('search.clarify.')) {
    const fromReplyKey = replyKey.replace('search.clarify.', '').trim();
    if (fromReplyKey && !missingFields.includes(fromReplyKey)) {
      missingFields.push(fromReplyKey);
    }
  }

  return Array.from(new Set(missingFields));
}

export function isClarifyPayload(payload: Record<string, unknown>): boolean {
  const replyKey = typeof payload.reply_key === 'string' ? payload.reply_key : '';
  return replyKey.startsWith('search.clarify.') || getClarifyFields(payload).length > 0;
}

export function parseFilterTokensFromText(text: string): ClarifyFilters {
  const result: ClarifyFilters = {};
  const tokens = text.split(/\s+/).map((token) => token.trim()).filter(Boolean);

  for (const token of tokens) {
    const idx = token.indexOf('=');
    if (idx <= 0) continue;

    const rawKey = token.slice(0, idx).trim().toLowerCase();
    const rawValue = token.slice(idx + 1).trim();
    if (!rawValue || FORBIDDEN_FILTER_KEYS.has(rawKey as keyof ClarifyFilters) || !ALLOWED_FILTER_KEYS.has(rawKey as keyof ClarifyFilters)) {
      continue;
    }

    if (rawKey === 'instruction_languages') {
      const langs = rawValue
        .split(',')
        .map((lang) => lang.trim().toLowerCase())
        .filter(Boolean);
      if (langs.length > 0) result.instruction_languages = langs;
      continue;
    }

    if (rawKey === 'intake_months') {
      const intakeMonths = parseIntakeMonths(rawValue);
      if (intakeMonths.length > 0) result.intake_months = intakeMonths;
      continue;
    }

    if (NUMBER_KEYS.has(rawKey as keyof ClarifyFilters)) {
      const parsed = parseNumber(rawKey as keyof ClarifyFilters, rawValue);
      if (parsed !== undefined) {
        (result as Record<string, unknown>)[rawKey] = parsed;
      }
      continue;
    }

    if (BOOLEAN_KEYS.has(rawKey as keyof ClarifyFilters)) {
      const parsed = parseBoolean(rawValue);
      if (parsed !== undefined) {
        (result as Record<string, unknown>)[rawKey] = parsed;
      }
      continue;
    }

    if (rawKey === 'deadline_before') {
      if (isValidIsoDate(rawValue)) result.deadline_before = rawValue;
      continue;
    }

    if (rawKey === 'country_code') {
      if (!COUNTRY_CODE_REGEX.test(rawValue)) continue;
      result.country_code = rawValue.toUpperCase();
      continue;
    }

    if (STRING_KEYS.has(rawKey as keyof ClarifyFilters)) {
      const normalized = rawKey === 'institution_id' ? rawValue.trim() : rawValue.toLowerCase();
      if (!normalized) continue;
      if (SLUG_KEYS.has(rawKey as keyof ClarifyFilters) && !SLUG_REGEX.test(normalized)) {
        continue;
      }
      (result as Record<string, unknown>)[rawKey] = normalized;
    }
  }

  return result;
}

export function mergeClarifyFilters(...filtersList: Array<ClarifyFilters | undefined>): ClarifyFilters {
  const merged: ClarifyFilters = {};

  for (const filters of filtersList) {
    if (!filters) continue;
    for (const [key, value] of Object.entries(filters)) {
      if (!ALLOWED_FILTER_KEYS.has(key as keyof ClarifyFilters)) continue;
      if (FORBIDDEN_FILTER_KEYS.has(key)) continue;
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'string' && value.trim().length === 0) continue;
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}

export function hasFilters(filters: ClarifyFilters | undefined): boolean {
  return Boolean(filters && Object.keys(filters).length > 0);
}
