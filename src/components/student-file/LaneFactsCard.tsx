// ═══════════════════════════════════════════════════════════════
// Door 2 — UI: Lane Facts Card (Truth Surface)
// ═══════════════════════════════════════════════════════════════
// Read-only display of canonical lane facts per document.
// Uses semantic tokens. No business logic. No editing.
// ═══════════════════════════════════════════════════════════════

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, ShieldCheck, AlertCircle, HelpCircle, FileSearch, Info } from 'lucide-react';
import type { LaneFactsRow } from '@/hooks/useDocumentLaneFacts';
import type { CanonicalField, FieldStatus } from '@/features/documents/lanes';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  facts: LaneFactsRow | null;
  fileName?: string;
  loading?: boolean;
}

const LANE_LABEL: Record<string, string> = {
  passport_lane: 'Passport',
  graduation_lane: 'Graduation Certificate',
  language_lane: 'Language Certificate',
};

const PASSPORT_FIELD_ORDER = [
  'full_name',
  'passport_number',
  'nationality',
  'date_of_birth',
  'expiry_date',
  'issuing_country',
  'sex',
  'mrz_present',
];

const CERT_FIELD_ORDER = [
  'student_name',
  'institution_name',
  'certificate_title',
  'issue_date',
  'graduation_year',
  'language_test_name',
  'score',
  'verification_ref',
];

function FieldStatusBadge({ status }: { status: FieldStatus }) {
  const cfg: Record<FieldStatus, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
    extracted: { label: 'extracted', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300', Icon: ShieldCheck },
    proposed: { label: 'proposed', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300', Icon: HelpCircle },
    missing: { label: 'missing', cls: 'bg-muted text-muted-foreground border-border', Icon: FileSearch },
    needs_review: { label: 'needs review', cls: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300', Icon: AlertCircle },
  };
  const { label, cls, Icon } = cfg[status];
  return (
    <Badge variant="outline" className={`gap-1 ${cls}`}>
      <Icon className="h-3 w-3" />
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </Badge>
  );
}

function FieldRow({ name, field }: { name: string; field: CanonicalField }) {
  const display = field.value ?? '—';
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{name.replace(/_/g, ' ')}</div>
        <div className={`text-sm font-medium truncate ${field.value ? 'text-foreground' : 'text-muted-foreground italic'}`}>
          {display}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {(field.confidence * 100).toFixed(0)}%
        </span>
        <FieldStatusBadge status={field.status} />
      </div>
    </div>
  );
}

export function LaneFactsCard({ facts, fileName, loading }: Props) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading lane facts…
      </Card>
    );
  }

  if (!facts) {
    return (
      <Card className="p-4 border-dashed">
        <div className="text-sm text-muted-foreground">
          No lane facts yet for this document.
          {fileName && <span className="block text-xs mt-1 opacity-70">{fileName}</span>}
        </div>
      </Card>
    );
  }

  const order = facts.lane === 'passport_lane' ? PASSPORT_FIELD_ORDER : CERT_FIELD_ORDER;
  const truthCfg = {
    extracted: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
    proposed: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
    needs_review: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300',
  } as const;

  const reviewReason = facts.engine_metadata?.review_reason ?? null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{LANE_LABEL[facts.lane] ?? facts.lane}</span>
            <Badge variant="outline" className={truthCfg[facts.truth_state]}>
              {facts.truth_state.replace('_', ' ')}
            </Badge>
            {facts.requires_review && (
              <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300">
                review required
              </Badge>
            )}
          </div>
          {fileName && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">{fileName}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">confidence</div>
          <div className="text-lg font-bold tabular-nums">{(facts.lane_confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      {reviewReason === 'image_ocr_deferred_to_door_3' && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{t('portal.studyFile.lane_review_reason.image_ocr_deferred_to_door_3')}</span>
        </div>
      )}

      <div className="rounded-md border border-border/60 bg-muted/20 p-3">
        {order.map((key) => {
          const f = facts.facts[key];
          if (!f) return null;
          return <FieldRow key={key} name={key} field={f} />;
        })}
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">audit notes ({facts.notes.length})</summary>
        <ul className="mt-1 space-y-0.5 font-mono">
          {facts.notes.map((n, i) => (
            <li key={i} className="opacity-80">• {n}</li>
          ))}
          <li className="opacity-60 pt-1">
            producer: {facts.engine_metadata.producer} ·{' '}
            {facts.engine_metadata.processing_ms}ms ·{' '}
            ocr={String(facts.engine_metadata.ocr_used)} ·{' '}
            pdf_text={String(facts.engine_metadata.pdf_text_used)}
          </li>
        </ul>
      </details>
    </Card>
  );
}
