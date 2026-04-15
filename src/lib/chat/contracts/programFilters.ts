import {
  BLOCKED_KEYWORD_SET,
  HARD16_SET,
  KEYWORD_SET,
  LOCKED_SET,
  RANK10_SET,
} from './filters';

export interface SanitizedProgramFilters {
  params: Record<string, unknown>;
  rank_filters?: Record<string, unknown>;
  invalidKeys: string[];
}

export function sanitizeProgramFilters(input: {
  params?: Record<string, unknown> | null;
  rank_filters?: Record<string, unknown> | null;
}): SanitizedProgramFilters {
  const params: Record<string, unknown> = {};
  const rankFilters: Record<string, unknown> = {};
  const invalidKeys: string[] = [];

  for (const [key, value] of Object.entries(input.params || {})) {
    if (value === null || value === undefined || value === '') continue;

    if (LOCKED_SET.has(key)) {
      invalidKeys.push(key);
      continue;
    }

    if (HARD16_SET.has(key)) {
      params[key] = value;
      continue;
    }

    if (KEYWORD_SET.has(key)) {
      if (typeof value === 'string' && value.trim()) {
        params.keyword = value.trim();
      }
      continue;
    }

    if (BLOCKED_KEYWORD_SET.has(key)) {
      invalidKeys.push(`blocked_alias:${key}`);
      continue;
    }

    invalidKeys.push(key);
  }

  for (const [key, value] of Object.entries(input.rank_filters || {})) {
    if (value === null || value === undefined || value === '') continue;

    if (LOCKED_SET.has(key)) {
      invalidKeys.push(`rank:${key}`);
      continue;
    }

    if (RANK10_SET.has(key)) {
      rankFilters[key] = value;
      continue;
    }

    invalidKeys.push(`rank:${key}`);
  }

  return {
    params,
    rank_filters: Object.keys(rankFilters).length > 0 ? rankFilters : undefined,
    invalidKeys,
  };
}
