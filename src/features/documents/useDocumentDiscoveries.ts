// ═══════════════════════════════════════════════════════════════
// useDocumentDiscoveries — AI-powered classification per uploaded file
// ═══════════════════════════════════════════════════════════════
// Calls the `analyze-document` edge function for each File and exposes
// a chronological feed of "discoveries" surfaced under the AnomalyOrb.
// Independent from upload registry — purely additive AI insight layer.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DiscoveryQuality =
  | "excellent"
  | "good"
  | "acceptable"
  | "poor"
  | "unreadable";

export type DiscoverySeverity = "success" | "info" | "warning" | "error";

export interface DocumentDiscovery {
  id: string;
  file_name: string;
  document_type: string;
  document_type_label: string;
  quality: DiscoveryQuality;
  quality_score: number;
  confidence: number;
  is_relevant: boolean;
  detected_fields: string[];
  warnings: string[];
  summary: string;
  severity: DiscoverySeverity;
  created_at: number;
  state: "analyzing" | "done" | "failed";
  error?: string;
}

const MAX_BYTES_INLINE = 6 * 1024 * 1024; // 6MB safety

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

function deriveSeverity(
  quality: DiscoveryQuality,
  isRelevant: boolean,
  warnings: string[],
): DiscoverySeverity {
  if (!isRelevant || quality === "unreadable") return "error";
  if (quality === "poor" || warnings.length >= 2) return "warning";
  if (quality === "excellent" || quality === "good") return "success";
  return "info";
}

export function useDocumentDiscoveries() {
  const [discoveries, setDiscoveries] = useState<DocumentDiscovery[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  const upsert = useCallback(
    (id: string, patch: Partial<DocumentDiscovery>) => {
      setDiscoveries((prev) => {
        const idx = prev.findIndex((d) => d.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      });
    },
    [],
  );

  const analyzeFiles = useCallback(
    async (files: File[], locale = "en") => {
      for (const file of files) {
        // Dedup by name+size+lastModified within session
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (seenRef.current.has(key)) continue;
        seenRef.current.add(key);

        const id = crypto.randomUUID();
        const initial: DocumentDiscovery = {
          id,
          file_name: file.name,
          document_type: "unknown",
          document_type_label: "",
          quality: "acceptable",
          quality_score: 0,
          confidence: 0,
          is_relevant: true,
          detected_fields: [],
          warnings: [],
          summary: "",
          severity: "info",
          created_at: Date.now(),
          state: "analyzing",
        };
        setDiscoveries((prev) => [...prev, initial]);

        // Skip oversized files inline; surface a warning instead
        if (file.size > MAX_BYTES_INLINE) {
          upsert(id, {
            state: "failed",
            severity: "warning",
            error: "file_too_large",
            summary: "",
            warnings: ["file_too_large"],
          });
          continue;
        }

        try {
          const base64 = await fileToBase64(file);
          const { data, error } = await supabase.functions.invoke(
            "analyze-document",
            {
              body: {
                file_name: file.name,
                mime_type: file.type || "application/octet-stream",
                base64,
                locale,
              },
            },
          );

          if (error) throw error;
          if (!data || (data as { error?: string }).error) {
            throw new Error((data as { error?: string })?.error || "no_data");
          }

          const d = data as Omit<
            DocumentDiscovery,
            "id" | "file_name" | "created_at" | "state" | "severity"
          >;

          upsert(id, {
            ...d,
            severity: deriveSeverity(d.quality, d.is_relevant, d.warnings),
            state: "done",
          });
        } catch (e) {
          upsert(id, {
            state: "failed",
            severity: "warning",
            error: e instanceof Error ? e.message : "unknown_error",
          });
        }
      }
    },
    [upsert],
  );

  const clear = useCallback(() => {
    setDiscoveries([]);
    seenRef.current.clear();
  }, []);

  return { discoveries, analyzeFiles, clear };
}
