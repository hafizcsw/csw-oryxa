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
  /** Delete a single CRM file (by file_id) and refresh */
  onDeleteDoc?: (crmFileId: string) => Promise<boolean>;
  /** Bulk-delete multiple CRM files */
  onDeleteAll?: (crmFileIds: string[]) => Promise<void>;
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
    const buckets: Record<DestinationLane, LaneDoc[]> = {
      identity: [],
      academic: [],
      language: [],
      needs_review: [],
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

    // Live analyses (only show docs the user has revealed)
    for (const a of analyses) {
      if (!revealedIds.has(a.document_id)) continue;
      const rec = recordsById.get(a.document_id);
      const filename = rec?.original_file_name ?? hydratedArtifactSurfaces[a.document_id]?.documentFilename ?? a.document_id;
      const artifact = artifacts[a.document_id] ?? null;
      const { lane, subMode, reason } = resolveDestinationLane(
        a.classification_result,
        a.classification_confidence,
      );
      buckets[lane].push({
        documentId: a.document_id,
        crmFileId: rec?.crm_file_id ?? a.document_id,
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
      // Treat as needs_review minimally — no analysis data
      buckets.needs_review.push({
        documentId: docId,
        crmFileId: docId,
        filename: surface.documentFilename ?? docId,
        previewUrl: previewUrls[docId] ?? null,
        analysis: null,
        artifact: null,
        proposals: proposalsByDoc.get(docId) ?? [],
        subMode: null,
        routeReason: 'classification_uncertain',
        animate: false,
      });
    }

    return { byLane: buckets };
  }, [
    analyses, revealedIds, records, proposals, artifacts,
    hydratedArtifactSurfaces, hydratedIds, previewUrls, subjectRows,
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
