// ═══════════════════════════════════════════════════════════════
// StudentEvaluationWorkspace
// ───────────────────────────────────────────────────────────────
// Renders the persisted Phase A evaluation under the extracted-info
// section. Two layers:
//   • Per-document normalized credentials (mapped under each doc id).
//   • A single student-level evaluation snapshot card (saved status,
//     last_computed_at, recompute reason, headline credential).
// No business logic here — pure presentation of useStudentEvaluation.
// ═══════════════════════════════════════════════════════════════

import { useTranslation } from 'react-i18next';
import {
  Loader2,
  ShieldCheck,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  EvaluationSnapshotResult,
  PersistedEvaluationSnapshot,
  PersistedNormalizedCredential,
  RecomputeReason,
} from '@/features/evaluation-snapshot/types';

interface StudentEvaluationWorkspaceProps {
  loading: boolean;
  computing: boolean;
  saved: boolean;
  credentialsByDocId: Record<string, PersistedNormalizedCredential>;
  snapshot: PersistedEvaluationSnapshot | null;
  snapshotResult: EvaluationSnapshotResult | null;
  lastComputedAt: string | null;
  recomputeReason: RecomputeReason | string | null;
  /** Optional map from document_id → display name (for nicer rendering). */
  documentNames?: Record<string, string>;
  onRecompute?: () => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function reasonLabel(t: ReturnType<typeof useTranslation>['t'], reason: string | null): string {
  if (!reason) return '—';
  return t(`portal.evaluation.recompute_reason.${reason}`, { defaultValue: reason });
}

export function StudentEvaluationWorkspace({
  loading,
  computing,
  saved,
  credentialsByDocId,
  snapshot,
  snapshotResult,
  lastComputedAt,
  recomputeReason,
  documentNames = {},
  onRecompute,
}: StudentEvaluationWorkspaceProps) {
  const { t } = useTranslation('common');

  const hasCredentials = Object.keys(credentialsByDocId).length > 0;

  // Don't render anything before the first load completes.
  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('portal.evaluation.loading', 'Loading evaluation…')}
        </div>
      </section>
    );
  }

  // No documents yet — render a passive placeholder so the workspace exists in the layout.
  if (!snapshot && !hasCredentials && !computing) {
    return (
      <section
        className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground"
        aria-label={t('portal.evaluation.region_label', 'Student evaluation workspace')}
      >
        <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p>
          {t(
            'portal.evaluation.empty',
            'Upload a graduation certificate, transcript, or language certificate to see the evaluation here.',
          )}
        </p>
      </section>
    );
  }

  return (
    <section
      className="space-y-4"
      aria-label={t('portal.evaluation.region_label', 'Student evaluation workspace')}
    >
      {/* ─── Header card: saved status + recompute meta ───────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                saved ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              )}
            >
              {computing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : saved ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t('portal.evaluation.title', 'Evaluation snapshot')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {computing
                  ? t('portal.evaluation.computing', 'Recomputing…')
                  : saved
                  ? t('portal.evaluation.saved', 'Saved · up to date')
                  : t('portal.evaluation.pending', 'Pending recompute')}
              </p>
            </div>
          </div>

          {onRecompute && (
            <Button size="sm" variant="outline" onClick={onRecompute} disabled={computing}>
              <RefreshCw className={cn('me-2 h-3.5 w-3.5', computing && 'animate-spin')} />
              {t('portal.evaluation.recompute', 'Recompute')}
            </Button>
          )}
        </div>

        {/* Stats */}
        {snapshotResult && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat
              label={t('portal.evaluation.docs_evaluated', 'Documents')}
              value={snapshotResult.documents_evaluated}
            />
            <Stat
              label={t('portal.evaluation.docs_passing', 'Passing')}
              value={snapshotResult.documents_passing}
              tone="success"
            />
            <Stat
              label={t('portal.evaluation.docs_review', 'Need review')}
              value={snapshotResult.documents_needing_review}
              tone={snapshotResult.documents_needing_review > 0 ? 'warning' : 'neutral'}
            />
          </div>
        )}

        {/* Headline credential */}
        {snapshotResult?.headline_credential && (
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('portal.evaluation.headline', 'Headline credential')}
            </p>
            <p className="mt-1 font-medium text-foreground">
              {snapshotResult.headline_credential.subtype ??
                snapshotResult.headline_credential.kind}
              {snapshotResult.headline_credential.grade_pct != null && (
                <span className="ms-2 text-muted-foreground">
                  · {snapshotResult.headline_credential.grade_pct}%
                </span>
              )}
              {snapshotResult.headline_credential.source_country && (
                <span className="ms-2 text-muted-foreground">
                  ({snapshotResult.headline_credential.source_country})
                </span>
              )}
            </p>
          </div>
        )}

        {/* Meta footer */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t('portal.evaluation.last_computed', 'Last computed')}: {formatDateTime(lastComputedAt)}
          </span>
          {recomputeReason && (
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              {t('portal.evaluation.reason', 'Reason')}: {reasonLabel(t, recomputeReason)}
            </span>
          )}
        </div>
      </div>

    </section>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-primary'
      : tone === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold', toneClass)}>{value}</p>
    </div>
  );
}
