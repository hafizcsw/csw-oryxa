import { HARD16_SET, KEYWORD_SET, RANK10_SET } from './filters';

export interface CardsQueryPayload {
  params: Record<string, unknown>;
  rank_filters?: Record<string, unknown>;
  filters_hash?: string;
}

/**
 * Build strict cards_query payload with contract allowlists only.
 * Unknown keys are dropped to avoid sending unsupported contract fields.
 */
export function buildCardsQueryPayload(input: {
  params?: Record<string, unknown> | null;
  rank_filters?: Record<string, unknown> | null;
  filters_hash?: string | null;
}): CardsQueryPayload {
  const params: Record<string, unknown> = {};
  const rankFilters: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input.params || {})) {
    if (value === null || value === undefined || value === '') continue;

    if (HARD16_SET.has(key)) {
      params[key] = value;
      continue;
    }

    if (KEYWORD_SET.has(key) && typeof value === 'string' && value.trim()) {
      params.keyword = value.trim();
    }
  }

  for (const [key, value] of Object.entries(input.rank_filters || {})) {
    if (value === null || value === undefined || value === '') continue;
    if (RANK10_SET.has(key)) {
      rankFilters[key] = value;
    }
  }

  const payload: CardsQueryPayload = { params };
  if (Object.keys(rankFilters).length > 0) {
    payload.rank_filters = rankFilters;
  }
  if (typeof input.filters_hash === 'string' && input.filters_hash.trim()) {
    payload.filters_hash = input.filters_hash;
  }

  return payload;
}
