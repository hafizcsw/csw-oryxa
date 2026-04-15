/**
 * Review panel for governed field edits (programs + scholarships).
 * Only super admins can approve/reject. Staff can view.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Check, X, Loader2, AlertCircle, Clock, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface GovernedEdit {
  id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  old_value: unknown;
  proposed_value: unknown;
  status: string;
  submitted_by: string;
  reviewed_by: string | null;
  reviewer_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

interface Props {
  universityId: string;
  isSuperAdmin?: boolean;
}

export function PageGovernedEditsPanel({ universityId, isSuperAdmin }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [edits, setEdits] = useState<GovernedEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fetchEdits = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'governed.list', university_id: universityId, status: filter || undefined } });
    if (data?.ok) setEdits(data.edits || []);
    setLoading(false);
  }, [universityId, filter]);

  useEffect(() => { fetchEdits(); }, [fetchEdits]);

  const reviewEdit = async (editId: string, decision: 'approved' | 'rejected') => {
    setReviewingId(editId);
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'governed.review', university_id: universityId, edit_id: editId, decision } });
    if (data?.ok) {
      toast({ title: decision === 'approved' ? t('pageOS.governed.approved') : t('pageOS.governed.rejected') });
      await fetchEdits();
    } else {
      toast({ title: data?.error || t('pageOS.governed.reviewError'), variant: 'destructive' });
    }
    setReviewingId(null);
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'pending': return <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">{t('pageOS.governed.statusPending')}</Badge>;
      case 'approved': return <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">{t('pageOS.governed.statusApproved')}</Badge>;
      case 'rejected': return <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">{t('pageOS.governed.statusRejected')}</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{s}</Badge>;
    }
  };

  const formatValue = (v: unknown) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-semibold">{t('pageOS.governed.title')}</h3>
          <Badge variant="secondary">{edits.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select className="text-sm border border-border rounded-lg px-2 py-1 bg-background" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="pending">{t('pageOS.governed.statusPending')}</option>
            <option value="approved">{t('pageOS.governed.statusApproved')}</option>
            <option value="rejected">{t('pageOS.governed.statusRejected')}</option>
            <option value="">{t('pageOS.governed.all')}</option>
          </select>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">{t('pageOS.governed.viewOnly')}</p>
        </div>
      )}

      {edits.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/30 p-8 flex flex-col items-center text-center gap-2">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('pageOS.governed.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {edits.map(edit => (
            <div key={edit.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{edit.entity_type}</Badge>
                  <span className="text-sm font-medium">{edit.field_name}</span>
                  {statusBadge(edit.status)}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(edit.submitted_at).toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground">{t('pageOS.governed.currentValue')}</span>
                  <div className="px-2 py-1.5 rounded bg-muted/50 font-mono break-all">{formatValue(edit.old_value)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">{t('pageOS.governed.proposedValue')}</span>
                  <div className="px-2 py-1.5 rounded bg-amber-50 border border-amber-200 font-mono break-all">{formatValue(edit.proposed_value)}</div>
                </div>
              </div>
              {edit.reviewer_note && (
                <p className="text-xs text-muted-foreground italic">{edit.reviewer_note}</p>
              )}
              {isSuperAdmin && edit.status === 'pending' && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                    disabled={reviewingId === edit.id}
                    onClick={() => reviewEdit(edit.id, 'approved')}
                  >
                    {reviewingId === edit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {t('pageOS.governed.approve')}
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                    disabled={reviewingId === edit.id}
                    onClick={() => reviewEdit(edit.id, 'rejected')}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('pageOS.governed.reject')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
