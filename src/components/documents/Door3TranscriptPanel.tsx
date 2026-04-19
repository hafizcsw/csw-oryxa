// ═══════════════════════════════════════════════════════════════
// Door3TranscriptPanel — TRUTH SURFACE only (no editing)
// ═══════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDoor3Transcript } from '@/features/documents/door3/hooks/useDoor3Transcript';
import { useDoor3Jobs } from '@/features/documents/door3/hooks/useDoor3Jobs';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  documentId: string;
}

export function Door3TranscriptPanel({ documentId }: Props) {
  const { t } = useLanguage();
  const { rows, summary, loading } = useDoor3Transcript(documentId);
  const { jobs } = useDoor3Jobs(documentId);
  const transcriptJob = jobs.find((j) => j.job_type === 'transcript_parse');

  const tStatus = (s: string) =>
    t(`portal.documents.door3.status.${s}`) || s;

  if (loading) {
    return <div className="text-sm text-muted-foreground p-4">{t('portal.documents.door3.loading')}</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('portal.documents.door3.title')}</CardTitle>
        {transcriptJob && (
          <Badge variant={statusVariant(transcriptJob.status)}>{tStatus(transcriptJob.status)}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label={t('portal.documents.door3.rows')} value={rows.length} />
          <Stat label={t('portal.documents.door3.summaryMetrics')} value={summary.length} />
          <Stat label={t('portal.documents.door3.jobAttempts')} value={transcriptJob?.attempts ?? 0} />
        </div>

        {summary.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('portal.documents.door3.summary')}</h4>
            <ul className="text-sm space-y-0.5">
              {summary.map((s) => (
                <li key={s.id} className="flex justify-between border-b border-border py-1">
                  <span className="text-muted-foreground">{s.normalized_label ?? s.metric_type}</span>
                  <span className="font-mono">
                    {s.normalized_numeric_value ?? s.raw_value ?? '—'}
                    <span className="ml-2 text-xs text-muted-foreground">({Math.round(s.confidence * 100)}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('portal.documents.door3.rows')}</h4>
            <div className="max-h-72 overflow-auto border border-border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">{t('portal.documents.door3.subject')}</th>
                    <th className="text-right p-2">{t('portal.documents.door3.credits')}</th>
                    <th className="text-right p-2">{t('portal.documents.door3.markGrade')}</th>
                    <th className="text-right p-2">{t('portal.documents.door3.confidence')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2">{r.subject_name_normalized ?? r.subject_name_raw ?? '—'}</td>
                      <td className="p-2 text-right font-mono">{r.credit_hours_numeric ?? r.credit_hours_raw ?? '—'}</td>
                      <td className="p-2 text-right font-mono">
                        {r.grade_raw ?? r.mark_raw ?? r.mark_numeric ?? '—'}
                      </td>
                      <td className="p-2 text-right font-mono">{Math.round(r.row_confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length === 0 && summary.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded">
            {t('portal.documents.door3.noFacts')}
            {transcriptJob?.status === 'worker_not_configured' && (
              <div className="mt-1 text-xs">{t('portal.documents.door3.workerNotConfigured')}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'completed': return 'default';
    case 'needs_review': return 'secondary';
    case 'failed': return 'destructive';
    default: return 'outline';
  }
}
