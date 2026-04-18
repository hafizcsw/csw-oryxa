// ═══════════════════════════════════════════════════════════════
// LiveProfileAssembly — orchestrator for the lower assembly UX
// ═══════════════════════════════════════════════════════════════
// Watches completed analyses, queues each as a "drop" into its
// resolved destination lane (identity/academic/language/needs_review),
// and renders the four lanes. Hydrated docs render in settled state
// without animation.
//
// HONESTY:
//   - Reading route (artifact.chosen_route) is shown SEPARATELY from
//     destination_lane (UI assignment).
//   - Field-level "accepted" is derived ONLY from proposal status /
//     promotedFields — never from template membership.
//   - Lane assignment requires resolved classification + sufficient
//     confidence; otherwise the doc lands in Needs Review.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DocumentAnalysis } from '@/features/documents/document-analysis-model';
import type { ExtractionProposal } from '@/features/documents/extraction-proposal-model';
import type { ReadingArtifact } from '@/features/documents/reading-artifact-model';
import type { DocumentRecord } from '@/features/documents/document-registry-model';
import type { PromotedField, HydratedArtifactSurface } from '@/hooks/useDocumentAnalysis';
import type { SubjectRow } from '@/features/academic-truth/types';
import { resolveDestinationLane, type DestinationLane } from '@/features/documents/assembly-field-templates';
import { AssemblyLane, type LaneDoc } from './AssemblyLane';

interface LiveProfileAssemblyProps {
  records: DocumentRecord[];
  analyses: DocumentAnalysis[];
  proposals: ExtractionProposal[];
  artifacts: Record<string, ReadingArtifact>;
  hydratedArtifactSurfaces: Record<string, HydratedArtifactSurface>;
  promotedFields: PromotedField[];
  subjectRows: SubjectRow[];
  previewUrls: Record<string, string | null>;
  /** CRM-listed documents — used to resolve real CRM file_id by filename */
  crmDocuments?: Array<{ id: string; file_name: string }>;
  /** Delete a single doc — by CRM file_id (may be null if local-only) and document_id */
  onDeleteDoc?: (crmFileId: string | null, documentId: string) => Promise<boolean>;
  /** Bulk-delete — list of {crmFileId, documentId} */
  onDeleteAll?: (items: Array<{ crmFileId: string | null; documentId: string }>) => Promise<void>;
  /** Inline-edit a field value — always lands as pending_review for staff. */
  onEditField?: (params: { documentId: string; fieldKey: string; newValue: string }) => void;
}

interface QueueEntry {
  documentId: string;
  enqueuedAt: number;
}

const REVEAL_DELAY_MS = 1100; // dropping animation duration

export function LiveProfileAssembly({
  records,
  analyses,
  proposals,
  artifacts,
  hydratedArtifactSurfaces,
  promotedFields,
  subjectRows,
  previewUrls,
  crmDocuments,
  onDeleteDoc,
  onDeleteAll,
}: LiveProfileAssemblyProps) {
  const { t } = useLanguage();

  // Track which document IDs have been "revealed" in the assembly
  // (i.e. drop animation completed and field reveal started).
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [queueHead, setQueueHead] = useState<QueueEntry | null>(null);
  const queueRef = useRef<QueueEntry[]>([]);
  const seenCompletedRef = useRef<Set<string>>(new Set());

  // Hydrated doc IDs render immediately as settled (no animation, no queue)
  const hydratedIds = useMemo(() => {
    const s = new Set<string>();
    for (const k of Object.keys(hydratedArtifactSurfaces)) s.add(k);
    return s;
  }, [hydratedArtifactSurfaces]);

  // Ingest newly-completed analyses into the queue
  useEffect(() => {
    for (const a of analyses) {
      if (a.analysis_status !== 'completed' && a.analysis_status !== 'failed' && a.analysis_status !== 'skipped') continue;
      if (seenCompletedRef.current.has(a.document_id)) continue;
      // If hydrated → mark revealed immediately, no queue
      if (hydratedIds.has(a.document_id)) {
        seenCompletedRef.current.add(a.document_id);
        setRevealedIds(prev => {
          if (prev.has(a.document_id)) return prev;
          const next = new Set(prev);
          next.add(a.document_id);
          return next;
        });
        continue;
      }
      seenCompletedRef.current.add(a.document_id);
      queueRef.current.push({ documentId: a.document_id, enqueuedAt: Date.now() });
    }
    // Kick the queue if nothing is currently animating
    setQueueHead(prev => prev ?? queueRef.current.shift() ?? null);
  }, [analyses, hydratedIds]);

  // Drive the queue: head → reveal after delay → next
  useEffect(() => {
    if (!queueHead) return;
    const id = window.setTimeout(() => {
      setRevealedIds(prev => {
        if (prev.has(queueHead.documentId)) return prev;
        const next = new Set(prev);
        next.add(queueHead.documentId);
        return next;
      });
      // small inter-doc gap
      window.setTimeout(() => {
        setQueueHead(queueRef.current.shift() ?? null);
      }, 250);
    }, REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [queueHead]);

  // Build LaneDocs from analyses + per-doc data
  const { byLane } = useMemo(() => {
    const laneMaps: Record<DestinationLane, Map<string, LaneDoc & { __sort: number }>> = {
      identity: new Map(),
      academic: new Map(),
      language: new Map(),
      needs_review: new Map(),
    };

    // Index helpers
    const recordsById = new Map<string, DocumentRecord>();
    for (const r of records) recordsById.set(r.document_id, r);
    const proposalsByDoc = new Map<string, ExtractionProposal[]>();
    for (const p of proposals) {
      const arr = proposalsByDoc.get(p.document_id) ?? [];
      arr.push(p);
      proposalsByDoc.set(p.document_id, arr);
    }
    const subjectRowsByDoc = new Map<string, SubjectRow[]>();
    for (const r of subjectRows) {
      if (!r.source_document_id) continue;
      const arr = subjectRowsByDoc.get(r.source_document_id) ?? [];
      arr.push(r);
      subjectRowsByDoc.set(r.source_document_id, arr);
    }

    // ── Resolve real CRM file_id by filename (fallback for hydrated/CRM-loaded docs) ──
    const crmIdByFilename = new Map<string, string>();
    const activeCrmFilenames = new Set<string>();
    for (const d of crmDocuments ?? []) {
      if (d.file_name) {
        activeCrmFilenames.add(d.file_name);
        if (!crmIdByFilename.has(d.file_name)) {
          crmIdByFilename.set(d.file_name, d.id);
        }
      }
    }
    const resolveCrmId = (filename: string | undefined, fallback: string | null): string | null => {
      if (filename && crmIdByFilename.has(filename)) return crmIdByFilename.get(filename)!;
      return fallback;
    };

    const upsertLaneDoc = (lane: DestinationLane, dedupeKey: string, sortValue: number, doc: LaneDoc) => {
      const existing = laneMaps[lane].get(dedupeKey);
      if (!existing || sortValue >= existing.__sort) {
        laneMaps[lane].set(dedupeKey, { ...doc, __sort: sortValue });
      }
    };

    // Live analyses (show only current-session docs or docs still backed by current CRM files)
    for (const a of analyses) {
      if (!revealedIds.has(a.document_id)) continue;

      // ── Hide failed / weak / unknown docs from the lower assembly ──
      // Per UX decision: these surface ONLY in the upper visualizer
      // (red wire + floating reason banner above the file). They must NOT
      // appear in the "Needs Review" lane below alongside successful files.
      const isFailedRead =
        a.analysis_status === 'failed' || a.analysis_status === 'skipped';
      const isUnknownOrWeak =
        a.classification_result === 'unknown' ||
        a.classification_result === 'unsupported' ||
        a.usefulness_status === 'not_useful' ||
        a.readability_status === 'unreadable';
      if (isFailedRead || isUnknownOrWeak) continue;

      const rec = recordsById.get(a.document_id);
      const filename = rec?.original_file_name ?? hydratedArtifactSurfaces[a.document_id]?.documentFilename ?? a.document_id;
      const resolvedCrmId = rec?.crm_file_id ?? resolveCrmId(filename, null);
      const isCurrentBackedDoc = !!rec || (!!filename && activeCrmFilenames.has(filename));
      if (!isCurrentBackedDoc) continue;

      const artifact = artifacts[a.document_id] ?? null;
      const { lane, subMode, reason } = resolveDestinationLane(
        a.classification_result,
        a.classification_confidence,
      );
      const dedupeKey = resolvedCrmId ? `crm:${resolvedCrmId}` : filename ? `name:${filename}` : `doc:${a.document_id}`;
      const sortValue = Date.parse(a.updated_at ?? a.created_at ?? '') || 0;

      upsertLaneDoc(lane, dedupeKey, sortValue, {
        documentId: a.document_id,
        crmFileId: resolvedCrmId,
        filename,
        previewUrl: previewUrls[a.document_id] ?? null,
        analysis: a,
        artifact,
        proposals: proposalsByDoc.get(a.document_id) ?? [],
        subMode,
        routeReason: reason,
        animate: !hydratedIds.has(a.document_id),
        subjectRows: subjectRowsByDoc.get(a.document_id),
      });
    }

    // Pure-hydrated docs that don't have a live analysis entry
    for (const [docId, surface] of Object.entries(hydratedArtifactSurfaces)) {
      if (analyses.some(a => a.document_id === docId)) continue;
      const filename = surface.documentFilename ?? docId;
      if (!filename || !activeCrmFilenames.has(filename)) continue;
      const resolvedCrmId = resolveCrmId(filename, null);
      const dedupeKey = resolvedCrmId ? `crm:${resolvedCrmId}` : `name:${filename}`;

      upsertLaneDoc('needs_review', dedupeKey, 0, {
        documentId: docId,
        crmFileId: resolvedCrmId,
        filename,
        previewUrl: previewUrls[docId] ?? null,
        analysis: null,
        artifact: null,
        proposals: proposalsByDoc.get(docId) ?? [],
        subMode: null,
        routeReason: 'classification_uncertain',
        animate: false,
      });
    }

    return {
      byLane: {
        identity: Array.from(laneMaps.identity.values()).map(({ __sort, ...doc }) => doc),
        academic: Array.from(laneMaps.academic.values()).map(({ __sort, ...doc }) => doc),
        language: Array.from(laneMaps.language.values()).map(({ __sort, ...doc }) => doc),
        needs_review: Array.from(laneMaps.needs_review.values()).map(({ __sort, ...doc }) => doc),
      },
    };
  }, [
    analyses, revealedIds, records, proposals, artifacts,
    hydratedArtifactSurfaces, hydratedIds, previewUrls, subjectRows, crmDocuments,
  ]);

  const totalRevealed =
    byLane.identity.length + byLane.academic.length +
    byLane.language.length + byLane.needs_review.length;

  if (totalRevealed === 0 && !queueHead) {
    // Nothing to show yet — keep silent (orb area handles in-progress state)
    return null;
  }

  return (
    <section
      className="space-y-4"
      data-live-profile-assembly
      data-revealed-count={totalRevealed}
    >
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('portal.assembly.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('portal.assembly.subtitle')}
          </p>
        </div>
        {queueHead && (
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t('portal.assembly.dropping')}
          </span>
        )}
      </header>

      {/* Needs Review zone is visually first per plan */}
      <AssemblyLane
        lane="needs_review"
        docs={byLane.needs_review}
        promotedFields={promotedFields}
        onDeleteDoc={onDeleteDoc}
        onDeleteAll={onDeleteAll}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AssemblyLane lane="identity" docs={byLane.identity} promotedFields={promotedFields} onDeleteDoc={onDeleteDoc} />
        <AssemblyLane lane="academic" docs={byLane.academic} promotedFields={promotedFields} onDeleteDoc={onDeleteDoc} />
        <AssemblyLane lane="language" docs={byLane.language} promotedFields={promotedFields} onDeleteDoc={onDeleteDoc} />
      </div>
    </section>
  );
}
