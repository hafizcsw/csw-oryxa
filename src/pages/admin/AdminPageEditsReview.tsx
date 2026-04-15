/**
 * Admin Page Edits Review Panel
 * Allows admins to view, approve, or reject institution page edit proposals.
 * Approved edits are published to the canonical truth source (universities table / university_media).
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, XCircle, Loader2, RefreshCw, FileText,
  ImageIcon, Pencil, ChevronDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PageEdit {
  id: string;
  university_id: string;
  submitted_by: string;
  block_type: 'about' | 'gallery' | 'cover' | 'logo';
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
  review_notes?: string;
}

export default function AdminPageEditsReview() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [edits, setEdits] = useState<PageEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEdits = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('institution-page-edit', { body: { action: 'list_pending' } });
      if (data?.ok) {
        setEdits(data.edits || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchEdits(); }, [fetchEdits]);

  const handleAction = async (editId: string, action: 'approve' | 'reject') => {
    setProcessingId(editId);
    try {
      const { data, error } = await supabase.functions.invoke('institution-page-edit', {
        body: {
          action,
          edit_id: editId,
          review_notes: reviewNotes[editId] || '',
        },
      });

      if (data?.ok) {
        toast({
          title: action === 'approve'
            ? t('institution.admin.approved')
            : t('institution.admin.rejected'),
        });
        setEdits(prev => prev.filter(e => e.id !== editId));
      } else {
        toast({ title: data?.error || 'Error', variant: 'destructive' });
      }
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' });
    }
    setProcessingId(null);
  };

  const BlockIcon = ({ type }: { type: string }) =>
    type === 'about' ? <Pencil className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {t('institution.admin.pageEdits')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('institution.admin.pendingEdits')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEdits} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && edits.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{t('institution.admin.noEdits')}</p>
        </div>
      )}

      <div className="space-y-3">
        {edits.map((edit) => (
          <div key={edit.id} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <button
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expandedId === edit.id ? null : edit.id)}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <BlockIcon type={edit.block_type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {t('institution.admin.block')}: {edit.block_type}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {edit.status}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground block truncate">
                  {t('institution.admin.submittedAt')}: {new Date(edit.created_at).toLocaleString()}
                </span>
              </div>
              <ChevronDown className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                expandedId === edit.id && 'rotate-180'
              )} />
            </button>

            {/* Expanded content */}
            {expandedId === edit.id && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                {/* Payload preview */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t('institution.admin.payload')}
                  </p>
                  <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {JSON.stringify(edit.payload, null, 2)}
                  </pre>
                </div>

                {/* Review notes input */}
                <Textarea
                  placeholder={t('institution.admin.reviewNotes')}
                  value={reviewNotes[edit.id] || ''}
                  onChange={(e) => setReviewNotes(prev => ({ ...prev, [edit.id]: e.target.value }))}
                  rows={2}
                  className="text-sm"
                />

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleAction(edit.id, 'reject')}
                    disabled={processingId === edit.id}
                  >
                    {processingId === edit.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    {t('institution.admin.reject')}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleAction(edit.id, 'approve')}
                    disabled={processingId === edit.id}
                  >
                    {processingId === edit.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {t('institution.admin.approve')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
