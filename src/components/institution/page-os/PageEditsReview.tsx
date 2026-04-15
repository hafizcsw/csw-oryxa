/**
 * Inline page edits review panel for the operator toolbar.
 * Shows pending cover/logo/about/gallery edits for this university.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, XCircle, Loader2, RefreshCw,
  ImageIcon, Pencil, ChevronDown, Camera
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PageEdit {
  id: string;
  university_id: string;
  submitted_by: string;
  block_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
  review_notes?: string;
}

interface PageEditsReviewProps {
  universityId: string;
}

export function PageEditsReview({ universityId }: PageEditsReviewProps) {
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
      const { data } = await supabase.functions.invoke('institution-page-edit', { body: { action: 'list_pending', university_id: universityId } });
      if (data?.ok) {
        const filtered = (data.edits || []).filter(
          (e: PageEdit) => e.university_id === universityId
        );
        setEdits(filtered);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [universityId]);

  useEffect(() => { fetchEdits(); }, [fetchEdits]);

  const handleAction = async (editId: string, action: 'approve' | 'reject') => {
    setProcessingId(editId);
    try {
      const { data } = await supabase.functions.invoke('institution-page-edit', { body: { action, edit_id: editId, review_notes: reviewNotes[editId] || '' } });
      if (data?.ok) {
        toast({ title: action === 'approve' ? t('institution.admin.approved') : t('institution.admin.rejected') });
        setEdits(prev => prev.filter(e => e.id !== editId));
      } else {
        toast({ title: data?.error || 'Error', variant: 'destructive' });
      }
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' });
    }
    setProcessingId(null);
  };

  const BlockIcon = ({ type }: { type: string }) => {
    if (type === 'cover' || type === 'logo') return <Camera className="w-4 h-4" />;
    if (type === 'gallery') return <ImageIcon className="w-4 h-4" />;
    return <Pencil className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (edits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{t('institution.admin.noEdits')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {t('institution.admin.pageEdits')} ({edits.length})
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchEdits}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {edits.map((edit) => (
        <div key={edit.id} className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
            onClick={() => setExpandedId(expandedId === edit.id ? null : edit.id)}
          >
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <BlockIcon type={edit.block_type} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{edit.block_type}</span>
                <Badge variant="secondary" className="text-xs">{edit.status}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(edit.created_at).toLocaleString()}
              </span>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', expandedId === edit.id && 'rotate-180')} />
          </button>

          {expandedId === edit.id && (
            <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
              {(edit.block_type === 'cover' || edit.block_type === 'logo') && (edit.payload?.url || edit.payload?.cover_image_url || edit.payload?.logoUrl) && (
                <img
                  src={(edit.payload.url || edit.payload.cover_image_url || edit.payload.logoUrl) as string}
                  alt={edit.block_type}
                  className={cn(
                    'rounded-md object-cover border',
                    edit.block_type === 'cover' ? 'w-full h-32' : 'w-20 h-20'
                  )}
                />
              )}
              <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
                {JSON.stringify(edit.payload, null, 2)}
              </pre>
              <Textarea
                placeholder={t('institution.admin.reviewNotes')}
                value={reviewNotes[edit.id] || ''}
                onChange={(e) => setReviewNotes(prev => ({ ...prev, [edit.id]: e.target.value }))}
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => handleAction(edit.id, 'reject')}
                  disabled={processingId === edit.id}
                >
                  {processingId === edit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                  {t('institution.admin.reject')}
                </Button>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => handleAction(edit.id, 'approve')}
                  disabled={processingId === edit.id}
                >
                  {processingId === edit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  {t('institution.admin.approve')}
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
