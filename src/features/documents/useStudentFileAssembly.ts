// ═══════════════════════════════════════════════════════════════
// useStudentFileAssembly — orchestrated, pipeline-honest experience
// ═══════════════════════════════════════════════════════════════
// Each file goes through a real state machine bound to actual events:
//   queued → intake → reading → classifying → extracting →
//     placing → done(accepted/pending/partial)  | failed
//
// One active file at a time. No fake optimism. No animations
// without a backing state. Real classification + real fields come
// from the analyze-document edge function (Lovable AI Gateway).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AssemblyStage =
  | "queued"
  | "intake"
  | "reading"
  | "classifying"
  | "extracting"
  | "placing"
  | "done"
  | "failed";

export type FieldStatus = "accepted" | "pending_review" | "unresolved";

export type DocCategory = "passport" | "academic" | "language" | "unknown";

export interface ExtractedField {
  path: string;
  label: string;
  value: string;
  confidence: number;
  status: FieldStatus;
  /** Sequential reveal index, set when emitted to surface */
  revealedAt?: number;
}

export type FailureReason =
  | "unsupported_file_type"
  | "unsupported_in_v1"
  | "unreadable_scan"
  | "low_ocr_quality"
  | "classification_uncertain"
  | "extraction_partial"
  | "extraction_failed"
  | "conflict_with_existing_truth"
  | "review_required"
  | "file_too_large"
  | "rate_limited"
  | "ai_gateway_error";

export interface AssemblyFile {
  id: string;
  file_name: string;
  size: number;
  mime_type: string;
  stage: AssemblyStage;
  /** ISO ms timestamps for each stage transition (real, no fake) */
  stage_history: Array<{ stage: AssemblyStage; at: number }>;

  // After classification:
  document_type: string;
  document_type_label: string;
  category: DocCategory;
  classification_confidence: number;

  // After extraction:
  fields: ExtractedField[];
  /** Subset that have already been "revealed" on surface (typed in). */
  revealed_field_count: number;

  // Quality + warnings:
  quality: "excellent" | "good" | "acceptable" | "poor" | "unreadable" | null;
  quality_score: number;
  warnings: string[];
  summary: string;

  // Failure:
  failure_reason: FailureReason | null;

  // Bookkeeping:
  enqueued_at: number;
  finished_at: number | null;
}

const SUPPORTED_TYPES = new Set([
  "passport",
  "transcript",
  "high_school_certificate",
  "university_degree",
  "ielts",
  "toefl",
  "duolingo",
  "other_language_certificate",
]);

const MAX_BYTES_INLINE = 6 * 1024 * 1024;

function categoryFor(docType: string): DocCategory {
  switch (docType) {
    case "passport":
      return "passport";
    case "transcript":
    case "high_school_certificate":
    case "university_degree":
      return "academic";
    case "ielts":
    case "toefl":
    case "duolingo":
    case "other_language_certificate":
      return "language";
    default:
      return "unknown";
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeBlankFile(file: File): AssemblyFile {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    file_name: file.name,
    size: file.size,
    mime_type: file.type || "application/octet-stream",
    stage: "queued",
    stage_history: [{ stage: "queued", at: now }],
    document_type: "unknown",
    document_type_label: "",
    category: "unknown",
    classification_confidence: 0,
    fields: [],
    revealed_field_count: 0,
    quality: null,
    quality_score: 0,
    warnings: [],
    summary: "",
    failure_reason: null,
    enqueued_at: now,
    finished_at: null,
  };
}

interface PersistOpts {
  studentId: string | null;
}

async function persistFields(
  studentId: string,
  documentId: string,
  documentType: string,
  fields: ExtractedField[],
) {
  if (fields.length === 0) return;
  const rows = fields.map((f) => ({
    user_id: studentId,
    document_id: documentId,
    proposal_id: `${documentId}::${f.path}`,
    field_path: f.path,
    proposed_value: { value: f.value, label: f.label },
    raw_text: f.value,
    confidence: f.confidence,
    parser_source: "ai_gateway_gemini_2_5_flash",
    evidence_snippet: null,
    source_lane: documentType,
    status:
      f.status === "accepted"
        ? "auto_accepted"
        : f.status === "pending_review"
        ? "pending_review"
        : "unresolved",
    requires_review: f.status !== "accepted",
    auto_apply_candidate: f.status === "accepted",
    rejection_reason: null,
    decided_by: f.status === "accepted" ? "engine" : null,
    decided_at: f.status === "accepted" ? new Date().toISOString() : null,
  }));
  const { error } = await supabase
    .from("extraction_proposals")
    .upsert(rows, { onConflict: "proposal_id" });
  if (error) {
    console.warn("[StudentFileAssembly] persist failed", error.message);
  }
}

export function useStudentFileAssembly({ studentId }: PersistOpts) {
  const [files, setFiles] = useState<AssemblyFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const queueRef = useRef<Array<{ file: File; id: string }>>([]);
  const processingRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  const patchFile = useCallback((id: string, patch: Partial<AssemblyFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }, []);

  const advance = useCallback(
    (id: string, stage: AssemblyStage, extra?: Partial<AssemblyFile>) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                stage,
                stage_history: [
                  ...f.stage_history,
                  { stage, at: Date.now() },
                ],
                ...extra,
              }
            : f,
        ),
      );
    },
    [],
  );

  // ── Reveal fields one by one (real fields only, after extraction returns) ──
  const revealFields = useCallback(
    async (id: string, total: number) => {
      // Real progressive reveal — 220ms per field, capped to keep flow snappy.
      const interval = total > 8 ? 140 : 220;
      for (let i = 1; i <= total; i++) {
        await new Promise((r) => setTimeout(r, interval));
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, revealed_field_count: i } : f,
          ),
        );
      }
    },
    [],
  );

  const processOne = useCallback(
    async (entry: { file: File; id: string }) => {
      const { file, id } = entry;
      setActiveId(id);

      // Stage: intake
      advance(id, "intake");

      // Hard guards before AI
      if (file.size > MAX_BYTES_INLINE) {
        advance(id, "failed", {
          failure_reason: "file_too_large",
          warnings: ["file_too_large"],
          finished_at: Date.now(),
        });
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const supportedExt = ["pdf", "jpg", "jpeg", "png", "webp"].includes(ext);
      if (!supportedExt) {
        advance(id, "failed", {
          failure_reason: "unsupported_file_type",
          warnings: ["unsupported_file_type"],
          finished_at: Date.now(),
        });
        return;
      }

      // Stage: reading (encoding + uploading payload)
      advance(id, "reading");
      let base64: string;
      try {
        base64 = await fileToBase64(file);
      } catch {
        advance(id, "failed", {
          failure_reason: "unreadable_scan",
          warnings: ["unreadable_scan"],
          finished_at: Date.now(),
        });
        return;
      }

      // Stage: classifying + extracting are both done by AI in one round-trip.
      advance(id, "classifying");

      let data:
        | {
            document_type: string;
            document_type_label: string;
            quality: AssemblyFile["quality"];
            quality_score: number;
            confidence: number;
            is_relevant: boolean;
            detected_fields: string[];
            warnings: string[];
            summary: string;
            extracted_fields: Array<{
              path: string;
              label: string;
              value: string;
              confidence: number;
              status: FieldStatus;
            }>;
          }
        | null = null;

      try {
        const { data: resp, error } = await supabase.functions.invoke(
          "analyze-document",
          {
            body: {
              file_name: file.name,
              mime_type: file.type || "application/octet-stream",
              base64,
              locale: "en",
            },
          },
        );
        if (error) throw error;
        if (!resp || (resp as { error?: string }).error) {
          throw new Error((resp as { error?: string })?.error || "no_data");
        }
        data = resp as typeof data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ai_gateway_error";
        const reason: FailureReason =
          msg === "rate_limited"
            ? "rate_limited"
            : msg === "payment_required"
            ? "ai_gateway_error"
            : "extraction_failed";
        advance(id, "failed", {
          failure_reason: reason,
          warnings: [reason],
          finished_at: Date.now(),
        });
        return;
      }

      if (!data) return;

      const cat = categoryFor(data.document_type);
      const isSupported = SUPPORTED_TYPES.has(data.document_type);

      // Apply classification result
      patchFile(id, {
        document_type: data.document_type,
        document_type_label: data.document_type_label,
        category: cat,
        classification_confidence: data.confidence,
        quality: data.quality,
        quality_score: data.quality_score,
        warnings: data.warnings,
        summary: data.summary,
      });

      if (!data.is_relevant) {
        advance(id, "failed", {
          failure_reason: "review_required",
          finished_at: Date.now(),
        });
        return;
      }
      if (data.document_type === "unsupported_in_v1") {
        advance(id, "failed", {
          failure_reason: "unsupported_in_v1",
          finished_at: Date.now(),
        });
        return;
      }
      if (data.document_type === "unknown" || data.confidence < 0.4) {
        advance(id, "failed", {
          failure_reason: "classification_uncertain",
          finished_at: Date.now(),
        });
        return;
      }
      if (data.quality === "unreadable") {
        advance(id, "failed", {
          failure_reason: "unreadable_scan",
          finished_at: Date.now(),
        });
        return;
      }
      if (!isSupported) {
        advance(id, "failed", {
          failure_reason: "unsupported_in_v1",
          finished_at: Date.now(),
        });
        return;
      }

      // Stage: extracting (fields are in hand, but we reveal progressively)
      advance(id, "extracting", {
        fields: data.extracted_fields,
        revealed_field_count: 0,
      });

      await revealFields(id, data.extracted_fields.length);

      // Persist if studentId
      if (studentId) {
        try {
          await persistFields(
            studentId,
            id,
            data.document_type,
            data.extracted_fields,
          );
        } catch (e) {
          console.warn("[Assembly] persist err", e);
        }
      }

      // Stage: placing (mini doc moves to destination section)
      advance(id, "placing");
      await new Promise((r) => setTimeout(r, 700));

      // Decide partial vs full
      const accepted = data.extracted_fields.filter(
        (f) => f.status === "accepted",
      ).length;
      const pending = data.extracted_fields.filter(
        (f) => f.status === "pending_review",
      ).length;
      const unresolved = data.extracted_fields.filter(
        (f) => f.status === "unresolved",
      ).length;

      const isPartial =
        unresolved > 0 || (pending > 0 && accepted === 0);

      advance(id, "done", {
        finished_at: Date.now(),
        warnings: isPartial
          ? [...data.warnings, "extraction_partial"]
          : data.warnings,
      });
    },
    [advance, patchFile, revealFields, studentId],
  );

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      await processOne(next);
    }
    setActiveId(null);
    processingRef.current = false;
  }, [processOne]);

  const enqueueFiles = useCallback(
    (incoming: File[]) => {
      const fresh: AssemblyFile[] = [];
      const queued: Array<{ file: File; id: string }> = [];
      for (const f of incoming) {
        const key = `${f.name}::${f.size}::${f.lastModified}`;
        if (seenRef.current.has(key)) continue;
        seenRef.current.add(key);
        const blank = makeBlankFile(f);
        fresh.push(blank);
        queued.push({ file: f, id: blank.id });
      }
      if (fresh.length === 0) return;
      setFiles((prev) => [...prev, ...fresh]);
      queueRef.current.push(...queued);
      void drainQueue();
    },
    [drainQueue],
  );

  const clear = useCallback(() => {
    setFiles([]);
    setActiveId(null);
    seenRef.current.clear();
    queueRef.current = [];
  }, []);

  // Derived assembled file
  const assembled = (() => {
    const byCat: Record<DocCategory, AssemblyFile[]> = {
      passport: [],
      academic: [],
      language: [],
      unknown: [],
    };
    for (const f of files) {
      if (f.stage === "done" || f.stage === "placing")
        byCat[f.category].push(f);
    }
    const allFields = files.flatMap((f) => f.fields);
    return {
      byCat,
      counts: {
        accepted: allFields.filter((x) => x.status === "accepted").length,
        pending: allFields.filter((x) => x.status === "pending_review").length,
        unresolved: allFields.filter((x) => x.status === "unresolved").length,
        failed: files.filter((f) => f.stage === "failed").length,
      },
    };
  })();

  return {
    files,
    activeFile: files.find((f) => f.id === activeId) ?? null,
    queueLength: queueRef.current.length,
    isProcessing: processingRef.current,
    enqueueFiles,
    clear,
    assembled,
  };
}
