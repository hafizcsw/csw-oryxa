// src/hooks/useSubmissionCache.ts
// Cache for submitted applications - used to enrich applications before CRM syncs

import { useCallback, useMemo } from "react";

export type SubmissionCacheItem = {
  application_id: string;
  program_id: string;
  program_name?: string;
  university_name?: string;
  country_code?: string;
  services: Array<{
    service_code: string;
    qty: number;
    name?: string;
    unit_price?: number;
    line_total?: number;
  }>;
  total_amount: number;
  currency: string;
  payment_id?: string;
  created_at: string;
};

const STORAGE_KEY = "portal_submission_cache_v1";

function safeParse(json: string | null): SubmissionCacheItem[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readAll(): SubmissionCacheItem[] {
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function writeAll(items: SubmissionCacheItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useSubmissionCache() {
  const getById = useCallback((applicationId: string) => {
    return readAll().find(item => item.application_id === applicationId) || null;
  }, []);

  const getByProgramId = useCallback((programId: string) => {
    return readAll().find(item => item.program_id === programId) || null;
  }, []);

  const save = useCallback((item: SubmissionCacheItem) => {
    const all = readAll();
    // Remove old entry for same application_id or program_id
    const filtered = all.filter(
      i => i.application_id !== item.application_id && i.program_id !== item.program_id
    );
    // Add new at front, keep max 20 items
    const next = [item, ...filtered].slice(0, 20);
    writeAll(next);
  }, []);

  const remove = useCallback((applicationId: string) => {
    const next = readAll().filter(i => i.application_id !== applicationId);
    writeAll(next);
  }, []);

  const getAll = useCallback(() => readAll(), []);

  return useMemo(() => ({
    getById,
    getByProgramId,
    save,
    remove,
    getAll,
  }), [getById, getByProgramId, save, remove, getAll]);
}
