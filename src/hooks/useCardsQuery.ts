/**
 * useCardsQuery Hook
 * Fetches cards from Portal Catalog based on CRM cards_query
 *
 * Fail-closed rules:
 * - Any contract violation => NO SEARCH
 * - Stale query => NO SEARCH
 * - ACK is sent by UI layer only after render
 */

import { useRef, useCallback } from 'react';

import { University } from '@/types/chat';
import { validateCardsQueryParams } from '@/lib/chat/sanitizer';
import { buildCardsQueryPayload, sanitizeProgramFilters } from '@/lib/chat/contracts';
import { buildCrmHeaders } from '@/lib/crmHeaders';

export interface CardsQuery {
  query_id: string;
  sequence: number;
  params: Record<string, unknown>;
  rank_filters?: Record<string, unknown>;
  filters_hash?: string;
  limit?: number;
  page?: number;
  page_token?: string;
}

export interface CardsQueryResult {
  programs: University[];
  next_page_token?: string | null;
  missing_fields?: string[];
  search_mode?: 'start' | 'hold';
  blocked?: boolean;
  blocked_reason?: 'stale' | 'contract' | 'hold';
  silent?: boolean;
  messageKey?: string;
}

export function useCardsQuery() {
  const lastSequenceRef = useRef(0);

  const fetchCards = useCallback(async (query: CardsQuery): Promise<CardsQueryResult> => {
    if (query.sequence <= lastSequenceRef.current) {
      console.log('[useCardsQuery] ⏭️ Stale query blocked:', query.sequence, '<=', lastSequenceRef.current);
      return { programs: [], next_page_token: null, search_mode: 'hold', blocked: true, blocked_reason: 'stale', silent: true };
    }

    lastSequenceRef.current = query.sequence;

    const validation = validateCardsQueryParams(query.params, query.rank_filters);
    if (!validation.canProceed) {
      console.error('[useCardsQuery] 🔴 Contract violation. Search blocked.', validation.violations);
      return {
        programs: [],
        next_page_token: null,
        search_mode: 'hold',
        blocked: true,
        blocked_reason: 'contract',
        messageKey: 'portal.chat.errors.filtersRejected',
      };
    }

    const sanitized = sanitizeProgramFilters({
      params: validation.validatedParams,
      rank_filters: validation.validatedRankFilters,
    });

    if (sanitized.invalidKeys.length > 0) {
      console.error('[useCardsQuery] 🔴 Invalid filters detected, search blocked.', sanitized.invalidKeys);
      return {
        programs: [],
        next_page_token: null,
        search_mode: 'hold',
        blocked: true,
        blocked_reason: 'contract',
        messageKey: 'portal.chat.errors.filtersRejected',
      };
    }

    try {
      const payload = buildCardsQueryPayload({
        params: sanitized.params,
        rank_filters: sanitized.rank_filters,
        filters_hash: query.filters_hash,
      });

      const page = Number.isFinite(query.page)
        ? Number(query.page)
        : (query.page_token && /^\d+$/.test(query.page_token) ? Number(query.page_token) : 1);

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const fetchHeaders = buildCrmHeaders({
        studentPortalToken: localStorage.getItem('student_portal_token') || undefined,
      });
      fetchHeaders['Authorization'] = `Bearer ${anonKey}`;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/search-programs`, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify({ ...payload, limit: query.limit || 12, page }),
      });

      if (query.sequence !== lastSequenceRef.current) {
        console.log('[useCardsQuery] ⏭️ Response stale after fetch:', query.sequence, '!==', lastSequenceRef.current);
        return { programs: [], next_page_token: null, search_mode: 'hold', blocked: true, blocked_reason: 'stale', silent: true };
      }

      if (!response.ok) {
        const contractRejected = response.status === 422;
        const errText = await response.text().catch(() => '');
        console.error('[useCardsQuery] ❌ Search failed:', response.status, errText);
        if (contractRejected) {
          return {
            programs: [],
            next_page_token: null,
            search_mode: 'hold',
            blocked: true,
            blocked_reason: 'contract',
            messageKey: 'portal.chat.errors.filtersRejected',
          };
        }
        return { programs: [], next_page_token: null, search_mode: 'hold', blocked: true, blocked_reason: 'hold' };
      }

      const data = await response.json();
      const programs = data?.items || data?.programs || [];
      const next_page_token = data?.next_page_token || null;
      const missing_fields = Array.isArray(data?.missing_fields) ? data.missing_fields : [];
      const search_mode = data?.search_mode === 'hold' || missing_fields.length > 0 ? 'hold' : 'start';
      return { programs, next_page_token, missing_fields, search_mode };
    } catch (e) {
      console.error('[useCardsQuery] ❌ Exception:', e);
      return { programs: [], next_page_token: null, search_mode: 'hold', blocked: true, blocked_reason: 'hold' };
    }
  }, []);

  const resetSequence = useCallback(() => {
    lastSequenceRef.current = 0;
  }, []);

  return { fetchCards, resetSequence };
}
