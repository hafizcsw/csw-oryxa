// ═══════════════════════════════════════════════════════════════
// AssemblyLane — one destination lane (Identity/Academic/Language/NeedsReview)
// ═══════════════════════════════════════════════════════════════
// Renders pinned doc chips, the per-doc header strip, ordered
// field rows, and lane-level honesty (academic metric pills /
// empty-state on failure / needs-review reason).
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import type { ReadingArtifact } from '@/features/documents/reading-artifact-model';
import type { DocumentAnalysis } from '@/features/documents/document-analysis-model';
import type { ExtractionProposal } from '@/features/documents/extraction-proposal-model';
import type { PromotedField } from '@/hooks/useDocumentAnalysis';
import {
  IDENTITY_FIELDS,
  LANGUAGE_FIELDS,
  ACADEMIC_GRADUATION_EXPECTED,
  ACADEMIC_TRANSCRIPT_EXPECTED,
  TRANSCRIPT_ROW_VISIBLE_CAP,
  type DestinationLane,
  type AcademicSubMode,
} from '@/features/documents/assembly-field-templates';
import type { SubjectRow } from '@/features/academic-truth/types';
import { DocAssemblyHeader } from './DocAssemblyHeader';
import { AssemblyDocChip } from './AssemblyDocChip';
import { AssemblyFieldRow, type FieldStatus } from './AssemblyFieldRow';

export interface LaneDoc {
  documentId: string;
  /** CRM file_id used to actually delete the file from storage */
  crmFileId?: string | null;
  filename: string;
  previewUrl?: string | null;
  analysis: DocumentAnalysis | null;
  artifact: ReadingArtifact | null;
  proposals: ExtractionProposal[];
  subMode: AcademicSubMode;
  routeReason: string | null;
  animate: boolean; // false for hydrated docs
  subjectRows?: SubjectRow[];
}

interface AssemblyLaneProps {
  lane: DestinationLane;
  docs: LaneDoc[];
  promotedFields: PromotedField[];
  /** Delete a single document — passes CRM file_id (may be null for local-only) and document_id */
  onDeleteDoc?: (crmFileId: string | null, documentId: string) => Promise<boolean>;
  /** Bulk-delete all docs in this lane */
  onDeleteAll?: (items: Array<{ crmFileId: string | null; documentId: string }>) => Promise<void>;
  /** Inline-edit a field value (always lands as pending_review) */
  onEditField?: (params: { documentId: string; fieldKey: string; newValue: string }) => void;
}

const LANE_CONFIG: Record<DestinationLane, { titleKey: string; descKey: string; tone: string }> = {
  identity: { titleKey: 'portal.assembly.lane.identity', descKey: 'portal.assembly.lane.identity_desc', tone: 'border-primary/30' },
  academic: { titleKey: 'portal.assembly.lane.academic', descKey: 'portal.assembly.lane.academic_desc', tone: 'border-primary/30' },
  language: { titleKey: 'portal.assembly.lane.language', descKey: 'portal.assembly.lane.language_desc', tone: 'border-primary/30' },
  needs_review: { titleKey: 'portal.assembly.lane.needs_review', descKey: 'portal.assembly.lane.needs_review_desc', tone: 'border-amber-500/30' },
};

export function AssemblyLane({ lane, docs, promotedFields, onDeleteDoc, onDeleteAll, onEditField }: AssemblyLaneProps) {
  const { t } = useLanguage();
  const cfg = LANE_CONFIG[lane];
  const isEmpty = docs.length === 0;
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const deletableItems = useMemo(
    () => docs.map(d => ({ crmFileId: d.crmFileId ?? null, documentId: d.documentId })),
    [docs],
  );

  const handleBulkDelete = async () => {
    if (!onDeleteAll || deletableItems.length === 0 || bulkDeleting) return;
    const confirmMsg = t('portal.assembly.lane.confirm_delete_all', { count: deletableItems.length });
    if (!window.confirm(confirmMsg)) return;
    setBulkDeleting(true);
    try {
      await onDeleteAll(deletableItems);
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <section
      className={cn(
        'rounded-xl border-2 bg-card/50 p-4 transition-colors',
        cfg.tone,
        isEmpty && 'opacity-60',
      )}
      data-assembly-lane={lane}
    >
      <header className="flex items-baseline justify-between mb-3 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{t(cfg.titleKey)}</h3>
          <p className="text-xs text-muted-foreground">{t(cfg.descKey)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            {t('portal.assembly.lane.doc_count', { count: docs.length })}
          </span>
          {lane === 'needs_review' && deletableItems.length > 0 && onDeleteAll && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              <span className="ms-1">{t('portal.assembly.lane.delete_all')}</span>
            </Button>
          )}
        </div>
      </header>

      {isEmpty ? (
        <p className="text-xs text-muted-foreground italic py-3">
          {t('portal.assembly.lane.waiting')}
        </p>
      ) : (
        <div className="space-y-4">
          {docs.map((doc) => (
            <DocBlock
              key={doc.documentId}
              lane={lane}
              doc={doc}
              promotedFields={promotedFields}
              onDeleteDoc={onDeleteDoc}
              onEditField={onEditField}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DocBlock({
  lane,
  doc,
  promotedFields,
  onDeleteDoc,
  onEditField,
}: {
  lane: DestinationLane;
  doc: LaneDoc;
  promotedFields: PromotedField[];
  onDeleteDoc?: (crmFileId: string | null, documentId: string) => Promise<boolean>;
  onEditField?: (params: { documentId: string; fieldKey: string; newValue: string }) => void;
}) {
  const { t } = useLanguage();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDeleteDoc || deleting) return;
    if (!window.confirm(t('portal.assembly.lane.confirm_delete_one'))) return;
    setDeleting(true);
    try {
      await onDeleteDoc(doc.crmFileId ?? null, doc.documentId);
    } finally {
      setDeleting(false);
    }
  };

  const DeleteBtn = onDeleteDoc ? (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 ms-auto text-destructive hover:text-destructive hover:bg-destructive/10"
      onClick={handleDelete}
      disabled={deleting}
      aria-label={t('portal.assembly.lane.delete_one')}
      title={t('portal.assembly.lane.delete_one')}
    >
      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  ) : null;

  const proposalByKey = useMemo(() => {
    const m = new Map<string, ExtractionProposal>();
    for (const p of doc.proposals) m.set(p.field_key, p);
    return m;
  }, [doc.proposals]);

  const promotedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const pf of promotedFields) {
      if (pf.documentId === doc.documentId) s.add(pf.fieldKey);
    }
    return s;
  }, [promotedFields, doc.documentId]);

  const docFailureReasonKey = doc.artifact?.failure_reason
    ? `portal.assembly.failure_reason.${doc.artifact.failure_reason}`
    : null;

  // Determine which field set to render
  let fieldKeys: readonly string[] = [];
  if (lane === 'identity') {
    fieldKeys = IDENTITY_FIELDS;
  } else if (lane === 'language') {
    fieldKeys = LANGUAGE_FIELDS;
  } else if (lane === 'academic') {
    // Extraction-driven: only render fields that have proposals,
    // but in deterministic order based on expected list when possible.
    const expected = doc.subMode === 'transcript'
      ? ACADEMIC_TRANSCRIPT_EXPECTED
      : ACADEMIC_GRADUATION_EXPECTED;
    const proposed = Array.from(proposalByKey.keys());
    const ordered: string[] = [];
    for (const k of expected) if (proposalByKey.has(k)) ordered.push(k);
    for (const k of proposed) if (!ordered.includes(k)) ordered.push(k);
    fieldKeys = ordered;
  }

  // Status resolver — proposal/promoted state ONLY, never template
  const resolveStatus = (fieldKey: string): { status: FieldStatus; value: string | null; reasonKey: string | null } => {
    const proposal = proposalByKey.get(fieldKey);
    const isPromoted = promotedKeys.has(fieldKey);

    if (proposal && proposal.proposal_status === 'auto_accepted') {
      return { status: 'accepted', value: proposal.proposed_value, reasonKey: null };
    }
    if (isPromoted) {
      return { status: 'accepted', value: proposal?.proposed_value ?? null, reasonKey: null };
    }
    if (proposal && proposal.proposal_status === 'pending_review') {
      return { status: 'pending', value: proposal.proposed_value, reasonKey: null };
    }
    if (proposal && proposal.proposal_status === 'rejected') {
      return { status: 'unresolved', value: null, reasonKey: 'portal.assembly.reason.rejected' };
    }
    // No proposal:
    if (docFailureReasonKey) {
      return { status: 'unresolved', value: null, reasonKey: docFailureReasonKey };
    }
    if (lane === 'identity' || lane === 'language') {
      return { status: 'unresolved', value: null, reasonKey: 'portal.assembly.reason.not_extracted' };
    }
    return { status: 'empty', value: null, reasonKey: null };
  };

  // Academic honesty footer metrics
  const academicMetrics = useMemo(() => {
    if (lane !== 'academic') return null;
    const expected = doc.subMode === 'transcript'
      ? ACADEMIC_TRANSCRIPT_EXPECTED
      : ACADEMIC_GRADUATION_EXPECTED;
    const extracted = doc.proposals.filter(p => p.proposed_value != null).length;
    const missing = expected.filter(k => !proposalByKey.has(k)).length;
    const subjectRows = doc.subMode === 'transcript' ? (doc.subjectRows?.length ?? 0) : 0;
    return { extracted, missing, subjectRows };
  }, [lane, doc.subMode, doc.proposals, doc.subjectRows, proposalByKey]);

  // Lane assignment for needs_review
  if (lane === 'needs_review') {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <AssemblyDocChip filename={doc.filename} previewUrl={doc.previewUrl} />
          <span className="text-[10px] uppercase tracking-wide text-destructive font-semibold px-1.5 py-0.5 rounded bg-destructive/10 border border-destructive/30">
            {t(`portal.assembly.route_reason.${doc.routeReason ?? 'classification_uncertain'}`)}
          </span>
          {DeleteBtn}
        </div>
        <DocAssemblyHeader
          destinationLane={lane}
          artifact={doc.artifact}
          analysis={doc.analysis}
          routeReason={doc.routeReason}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <AssemblyDocChip filename={doc.filename} previewUrl={doc.previewUrl} />
        {DeleteBtn}
      </div>

      <DocAssemblyHeader
        destinationLane={lane}
        artifact={doc.artifact}
        analysis={doc.analysis}
        routeReason={doc.routeReason}
      />

      {/* Field rows */}
      {fieldKeys.length === 0 && lane === 'academic' ? (
        <p className="text-xs text-muted-foreground italic">
          {t('portal.assembly.academic.no_fields_extracted')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {fieldKeys.map((key, idx) => {
            const r = resolveStatus(key);
            return (
              <AssemblyFieldRow
                key={key}
                fieldKey={key}
                value={r.value}
                status={r.status}
                reasonKey={r.reasonKey}
                animate={doc.animate}
                delay={doc.animate ? 70 * idx : 0}
                onSave={onEditField ? (newValue) => onEditField({ documentId: doc.documentId, fieldKey: key, newValue }) : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Transcript subject rows (capped) */}
      {lane === 'academic' && doc.subMode === 'transcript' && doc.subjectRows && doc.subjectRows.length > 0 && (
        <div className="pt-2 border-t border-border/40">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
            {t('portal.assembly.academic.subject_rows_label')}
          </div>
          <div className="space-y-1">
            {doc.subjectRows.slice(0, TRANSCRIPT_ROW_VISIBLE_CAP).map((row, idx) => (
              <SubjectRowLine
                key={row.row_id}
                row={row}
                animate={doc.animate}
                delay={doc.animate ? 140 * idx + 200 : 0}
              />
            ))}
            {doc.subjectRows.length > TRANSCRIPT_ROW_VISIBLE_CAP && (
              <div className="text-[11px] text-muted-foreground italic pt-1">
                {t('portal.assembly.academic.more_rows', {
                  count: doc.subjectRows.length - TRANSCRIPT_ROW_VISIBLE_CAP,
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Academic honesty footer metrics */}
      {lane === 'academic' && academicMetrics && (
        <div className="pt-2 border-t border-border/40 flex flex-wrap gap-1.5">
          <MetricPill labelKey="portal.assembly.academic.metric.extracted" count={academicMetrics.extracted} />
          <MetricPill labelKey="portal.assembly.academic.metric.missing" count={academicMetrics.missing} tone="warn" />
          <MetricPill labelKey="portal.assembly.academic.metric.subject_rows" count={academicMetrics.subjectRows} />
        </div>
      )}
    </div>
  );
}

function MetricPill({ labelKey, count, tone = 'neutral' }: { labelKey: string; count: number; tone?: 'neutral' | 'warn' }) {
  const { t } = useLanguage();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border',
        tone === 'warn' && count > 0
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-border bg-card text-foreground/80',
      )}
    >
      <span className="font-semibold">{count}</span>
      <span className="opacity-80">{t(labelKey, { count })}</span>
    </span>
  );
}

function SubjectRowLine({ row, animate, delay }: { row: SubjectRow; animate: boolean; delay: number }) {
  const { t } = useLanguage();
  const [shown, setShown] = useReveal(animate, delay);
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 text-xs px-2 py-1 rounded border border-border/40 bg-card/60 transition-all duration-300',
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium text-foreground">{row.subject_raw_name}</div>
        <div className="text-[10px] text-muted-foreground">
          {t(`portal.assembly.subject_family.${row.subject_family}`)}
        </div>
      </div>
      <div className="text-[11px] font-mono text-muted-foreground shrink-0">
        {row.grade_raw ?? '—'}
      </div>
    </div>
  );
}

// Tiny hook to avoid useState/useEffect repetition
import { useEffect } from 'react';
function useReveal(animate: boolean, delay: number): [boolean, (b: boolean) => void] {
  const [shown, setShown] = useState(!animate);
  useEffect(() => {
    if (!animate) { setShown(true); return; }
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [animate, delay]);
  return [shown, setShown];
}
