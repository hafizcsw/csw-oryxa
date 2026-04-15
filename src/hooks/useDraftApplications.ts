// src/hooks/useDraftApplications.ts
import { useCallback, useEffect, useMemo, useState } from "react";

export type DraftServiceLine = {
  service_code: string;
  qty: number;
  name?: string;
  unit_price?: number;
  line_total?: number;
};

export type DraftApplication = {
  draft_id: string;
  program_id: string;
  program_name?: string;
  university_name?: string;
  country_code?: string;
  services: DraftServiceLine[];
  total_amount?: number;
  currency?: string;
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = "portal_draft_applications_v1";

function safeParse(json: string | null): DraftApplication[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readAll(): DraftApplication[] {
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function writeAll(drafts: DraftApplication[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  // trigger same-tab updates
  window.dispatchEvent(new Event("portal_drafts_updated"));
}

export function useDraftApplications() {
  const [drafts, setDrafts] = useState<DraftApplication[]>(() => readAll());

  const refresh = useCallback(() => setDrafts(readAll()), []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    const onLocal = () => refresh();

    window.addEventListener("storage", onStorage);
    window.addEventListener("portal_drafts_updated", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("portal_drafts_updated", onLocal);
    };
  }, [refresh]);

  const getById = useCallback((draftId: string) => {
    return readAll().find(d => d.draft_id === draftId) || null;
  }, []);

  const getByProgramId = useCallback((programId: string) => {
    return readAll().find(d => d.program_id === programId) || null;
  }, []);

  const upsert = useCallback((draft: DraftApplication) => {
    const all = readAll();
    const idx = all.findIndex(d => d.draft_id === draft.draft_id);
    const next = [...all];

    if (idx >= 0) next[idx] = draft;
    else next.unshift(draft);

    writeAll(next);
    setDrafts(next);
  }, []);

  // convenient: keep one active draft per program
  const upsertForProgram = useCallback((draft: Omit<DraftApplication, "draft_id" | "created_at" | "updated_at"> & { draft_id?: string }) => {
    const all = readAll();
    const existing = all.find(d => d.program_id === draft.program_id);

    const now = new Date().toISOString();
    const merged: DraftApplication = {
      draft_id: draft.draft_id || existing?.draft_id || `draft_${Date.now()}`,
      created_at: existing?.created_at || now,
      updated_at: now,
      ...existing,
      ...draft,
    };

    const next = [merged, ...all.filter(d => d.draft_id !== merged.draft_id)];
    writeAll(next);
    setDrafts(next);
    return merged;
  }, []);

  const remove = useCallback((draftId: string) => {
    const next = readAll().filter(d => d.draft_id !== draftId);
    writeAll(next);
    setDrafts(next);
  }, []);

  const removeByProgramId = useCallback((programId: string) => {
    const next = readAll().filter(d => d.program_id !== programId);
    writeAll(next);
    setDrafts(next);
  }, []);

  const clearAll = useCallback(() => {
    writeAll([]);
    setDrafts([]);
  }, []);

  return useMemo(() => ({
    drafts,
    refresh,
    getById,
    getByProgramId,
    upsert,
    upsertForProgram,
    remove,
    removeByProgramId,
    clearAll,
  }), [drafts, refresh, getById, getByProgramId, upsert, upsertForProgram, remove, removeByProgramId, clearAll]);
}
