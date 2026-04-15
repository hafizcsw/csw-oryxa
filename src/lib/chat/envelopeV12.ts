import { z } from 'zod';
import { ALL_ALLOWED_SET, ALL_ALLOWED_KEYS } from './contracts/filters';

export type EnvelopeType = 'chat_message' | 'render_receipt' | 'control_patch';
export type SessionType = 'guest' | 'authenticated';

const LS_STATE_REV = 'portal_state_rev_by_session_v1';
const LS_FILTERS = 'portal_filters_snapshot_v1';
const SS_REQ_IDS = 'portal_client_request_ids_v1';

const ARRAY_KEYS = new Set(['instruction_languages', 'intake_months']);
const NUMBER_KEYS = new Set([
  'tuition_usd_min',
  'tuition_usd_max',
  'duration_months_max',
  'dorm_price_monthly_usd_max',
  'monthly_living_usd_max',
  'ranking_year',
  'world_rank_max',
  'national_rank_max',
  'overall_score_min',
  'teaching_score_min',
  'employability_score_min',
  'academic_reputation_score_min',
  'research_score_min',
]);
const DATE_KEYS = new Set(['deadline_before']);
const BOOL_KEYS = new Set(['has_dorm', 'scholarship_available']);
const SLUG_OR_ID_KEYS = new Set([
  'country_code',
  'city',
  'degree_slug',
  'discipline_slug',
  'study_mode',
  'scholarship_type',
  'institution_id',
  'ranking_system',
]);

const patchOpSchema = z.object({
  op: z.enum(['add', 'replace', 'remove']),
  path: z.string().regex(/^\/filters\/[a-z0-9_]+$/),
  value: z.unknown().optional(),
});

const envelopeSchema = z.object({
  envelope_version: z.literal('1.2'),
  envelope_type: z.enum(['chat_message', 'render_receipt', 'control_patch']),
  trace_id: z.string().min(8),
  client_request_id: z.string().min(8),
  session_id: z.string().min(8),
  channel: z.enum(['web_chat', 'web_portal']),
  actor: z.object({
    type: z.literal('portal'),
    id: z.literal('portal-web'),
  }),
  subject_customer_id: z.string().min(1).optional(),
  ui_locale: z.string().min(2),
  output_locale: z.string().min(2),
  expected_state_rev: z.number().int().positive().optional(),
  filters_patch: z.array(patchOpSchema).optional(),
  payload: z.record(z.unknown()),
});

export type FiltersPatchOp = z.infer<typeof patchOpSchema>;
export type EnvelopeV12 = z.infer<typeof envelopeSchema>;

export class EnvelopeValidationError extends Error {
  key: string;
  constructor(key: string) {
    super(key);
    this.key = key;
  }
}

function readJsonMap<T>(storage: Storage, key: string): Record<string, T> {
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, T> : {};
  } catch {
    return {};
  }
}

function writeJsonMap<T>(storage: Storage, key: string, value: Record<string, T>): void {
  storage.setItem(key, JSON.stringify(value));
}

function inferPatchValueType(key: string, value: unknown): boolean {
  if (NUMBER_KEYS.has(key)) return typeof value === 'number' && Number.isFinite(value);
  if (ARRAY_KEYS.has(key)) return Array.isArray(value) && value.every((item) => typeof item === 'string');
  if (DATE_KEYS.has(key)) return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (BOOL_KEYS.has(key)) return typeof value === 'boolean';
  return typeof value === 'string';
}

function assertSlugOrIdValue(key: string, value: unknown): void {
  if (!SLUG_OR_ID_KEYS.has(key)) return;
  if (typeof value !== 'string') {
    throw new EnvelopeValidationError('portal.chat.errors.filtersPatchInvalidType');
  }
  if (/\s/.test(value)) {
    throw new EnvelopeValidationError('portal.chat.errors.filtersPatchUseSlug');
  }
}

export function composeFiltersPatch(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): FiltersPatchOp[] {
  const prev = previous ?? {};
  const curr = next ?? {};
  const ops: FiltersPatchOp[] = [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(curr)]);

  for (const key of keys) {
    if (!ALL_ALLOWED_SET.has(key)) {
      throw new EnvelopeValidationError('portal.chat.errors.filtersPatchKeyNotAllowed');
    }

    const path = `/filters/${key}`;
    const hasPrev = Object.prototype.hasOwnProperty.call(prev, key);
    const hasCurr = Object.prototype.hasOwnProperty.call(curr, key);
    const nextValue = curr[key];

    const shouldRemove = !hasCurr
      || nextValue === null
      || nextValue === ''
      || (ARRAY_KEYS.has(key) && Array.isArray(nextValue) && nextValue.length === 0);

    if (shouldRemove) {
      if (hasPrev) ops.push({ op: 'remove', path });
      continue;
    }

    if (!inferPatchValueType(key, nextValue)) {
      throw new EnvelopeValidationError('portal.chat.errors.filtersPatchInvalidType');
    }

    assertSlugOrIdValue(key, nextValue);

    if (!hasPrev) {
      ops.push({ op: 'add', path, value: nextValue });
      continue;
    }

    const prevValue = prev[key];
    if (JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
      ops.push({ op: 'replace', path, value: nextValue });
    }
  }

  return ops;
}

export function getLastKnownStateRev(sessionId: string): number | null {
  const map = readJsonMap<number>(localStorage, LS_STATE_REV);
  const val = map[sessionId];
  return typeof val === 'number' ? val : null;
}

export function setLastKnownStateRev(sessionId: string, stateRev: number): void {
  const map = readJsonMap<number>(localStorage, LS_STATE_REV);
  map[sessionId] = stateRev;
  writeJsonMap(localStorage, LS_STATE_REV, map);
}

function getFiltersSnapshot(sessionId: string): Record<string, unknown> {
  const map = readJsonMap<Record<string, unknown>>(localStorage, LS_FILTERS);
  return map[sessionId] ?? {};
}

function setFiltersSnapshot(sessionId: string, filters: Record<string, unknown>): void {
  const map = readJsonMap<Record<string, unknown>>(localStorage, LS_FILTERS);
  map[sessionId] = filters;
  writeJsonMap(localStorage, LS_FILTERS, map);
}

export function getStableClientRequestId(retryKey: string): string {
  const map = readJsonMap<string>(sessionStorage, SS_REQ_IDS);
  if (map[retryKey]) return map[retryKey];
  const id = `req_${crypto.randomUUID()}`;
  map[retryKey] = id;
  writeJsonMap(sessionStorage, SS_REQ_IDS, map);
  return id;
}

function detectStateRev(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const direct = (data as Record<string, unknown>).state_rev;
  if (typeof direct === 'number') return direct;
  const nested = (data as Record<string, unknown>).session_state as Record<string, unknown> | undefined;
  if (nested && typeof nested.state_rev === 'number') return nested.state_rev;
  return null;
}

export function captureStateRevFromResponse(sessionId: string, responseData: unknown): void {
  const rev = detectStateRev(responseData);
  if (typeof rev === 'number' && Number.isFinite(rev) && rev > 0) {
    setLastKnownStateRev(sessionId, rev);
  }
}

interface BuildEnvelopeInput {
  envelope_type: EnvelopeType;
  payload: Record<string, unknown>;
  session_id: string;
  session_type: SessionType;
  locale: string;
  trace_id: string;
  retry_key: string;
  customer_id?: string;
  subject_customer_id?: string;
  filters?: Record<string, unknown>;
  output_locale?: string;
}

export function buildEnvelopeV12(input: BuildEnvelopeInput): EnvelopeV12 {
  const channel = input.session_type === 'authenticated' ? 'web_portal' : 'web_chat';
  const client_request_id = getStableClientRequestId(input.retry_key);

  const filters_patch = input.filters
    ? composeFiltersPatch(getFiltersSnapshot(input.session_id), input.filters)
    : undefined;

  const expected_state_rev = filters_patch && filters_patch.length > 0
    ? getLastKnownStateRev(input.session_id) ?? undefined
    : undefined;

  if (filters_patch && filters_patch.length > 0 && getLastKnownStateRev(input.session_id) !== null && expected_state_rev === undefined) {
    throw new EnvelopeValidationError('portal.chat.errors.expectedStateRevRequired');
  }

  const envelopeCandidate: EnvelopeV12 = {
    envelope_version: '1.2',
    envelope_type: input.envelope_type,
    trace_id: input.trace_id,
    client_request_id,
    session_id: input.session_id,
    channel,
    actor: { type: 'portal', id: 'portal-web' },
    ...(input.subject_customer_id ? { subject_customer_id: input.subject_customer_id } : {}),
    ...(input.customer_id ? { subject_customer_id: input.customer_id } : {}),
    ui_locale: input.locale,
    output_locale: input.output_locale ?? input.locale,
    ...(expected_state_rev !== undefined ? { expected_state_rev } : {}),
    ...(filters_patch && filters_patch.length > 0 ? { filters_patch } : {}),
    payload: input.payload,
  };

  const parsed = envelopeSchema.safeParse(envelopeCandidate);
  if (!parsed.success) {
    throw new EnvelopeValidationError('portal.chat.errors.invalidEnvelope');
  }

  if (input.filters) {
    const sanitized: Record<string, unknown> = {};
    for (const key of ALL_ALLOWED_KEYS) {
      if (Object.prototype.hasOwnProperty.call(input.filters, key)) {
        const value = input.filters[key];
        if (value !== undefined && value !== null && value !== '') {
          sanitized[key] = value;
        }
      }
    }
    setFiltersSnapshot(input.session_id, sanitized);
  }

  return parsed.data;
}
