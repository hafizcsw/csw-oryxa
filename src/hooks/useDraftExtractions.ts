// ═══════════════════════════════════════════════════════════════
// useDraftExtractions — Order 3R.2
// ───────────────────────────────────────────────────────────────
// Read-only fetch of portal_document_draft_extractions for the
// current student. Scoped to a list of draft IDs. RLS already
// restricts rows to auth.uid() = student_user_id.
//
// No writes. No CRM contact. No identity surface.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DraftExtractionFact {
  value?: unknown;
  status?: string;
  confidence?: number;
  evidence_id?: string | null;
  evidence_quote?: string | null;
  source?: string | null;
}

export interface DraftExtractionMissingField {
  key: string;
  reason?: string;
}

export interface DraftExtractionRow {
  id: string;
  draft_id: string;
  family: string | null;
  family_confidence: number | null;
  is_recognized: boolean;
  truth_state: string | null;
  lane_confidence: number | null;
  facts: Record<string, DraftExtractionFact>;
  ocr_engine_path: string | null;
  ocr_pages: number | null;
  ocr_chars: number | null;
  ocr_quality_flags: string[];
  engine_metadata: Record<string, unknown>;
  trace_id: string | null;
  created_at: string;
  /** Pulled out of engine_metadata.missing_fields for convenience. */
  missing_fields: DraftExtractionMissingField[];
}

function normalizeRow(raw: any): DraftExtractionRow {
  const meta = (raw?.engine_metadata ?? {}) as Record<string, unknown>;
  const missingRaw = Array.isArray((meta as any).missing_fields)
    ? ((meta as any).missing_fields as any[])
    : [];
  const missing_fields: DraftExtractionMissingField[] = missingRaw
    .map((m) =>
      typeof m === "string"
        ? { key: m }
        : { key: String((m as any)?.key ?? ""), reason: (m as any)?.reason },
    )
    .filter((m) => m.key);

  const flagsRaw = (raw?.ocr_quality_flags ?? []) as unknown;
  const flags: string[] = Array.isArray(flagsRaw)
    ? flagsRaw.map((f) => String(f))
    : [];

  return {
    id: String(raw?.id ?? ""),
    draft_id: String(raw?.draft_id ?? ""),
    family: raw?.family ?? null,
    family_confidence: raw?.family_confidence ?? null,
    is_recognized: !!raw?.is_recognized,
    truth_state: raw?.truth_state ?? null,
    lane_confidence: raw?.lane_confidence ?? null,
    facts: (raw?.facts ?? {}) as Record<string, DraftExtractionFact>,
    ocr_engine_path: raw?.ocr_engine_path ?? null,
    ocr_pages: raw?.ocr_pages ?? null,
    ocr_chars: raw?.ocr_chars ?? null,
    ocr_quality_flags: flags,
    engine_metadata: meta,
    trace_id: raw?.trace_id ?? null,
    created_at: String(raw?.created_at ?? ""),
    missing_fields,
  };
}

interface UseDraftExtractionsResult {
  byDraftId: Record<string, DraftExtractionRow>;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useDraftExtractions(
  draftIds: string[],
): UseDraftExtractionsResult {
  const [rows, setRows] = useState<DraftExtractionRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Stabilise dependency
  const key = useMemo(() => [...draftIds].sort().join(","), [draftIds]);

  const fetchRows = useCallback(async () => {
    if (!key) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const ids = key.split(",").filter(Boolean);
      const { data, error } = await supabase
        .from("portal_document_draft_extractions")
        .select(
          "id, draft_id, family, family_confidence, is_recognized, truth_state, lane_confidence, facts, ocr_engine_path, ocr_pages, ocr_chars, ocr_quality_flags, engine_metadata, trace_id, created_at",
        )
        .in("draft_id", ids)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("[useDraftExtractions] select failed", error.message);
        setRows([]);
        return;
      }
      setRows((data ?? []).map(normalizeRow));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  // Keep most-recent row per draft_id
  const byDraftId = useMemo(() => {
    const map: Record<string, DraftExtractionRow> = {};
    for (const r of rows) {
      if (!map[r.draft_id]) map[r.draft_id] = r;
    }
    return map;
  }, [rows]);

  return { byDraftId, loading, refetch: fetchRows };
}
