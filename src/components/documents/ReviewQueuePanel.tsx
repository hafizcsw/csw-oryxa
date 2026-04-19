// ═══════════════════════════════════════════════════════════════
// ReviewQueuePanel — Door 3 review surface
// ═══════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDoor3ReviewQueue } from '@/features/documents/door3/hooks/useDoor3ReviewQueue';
import { useLanguage } from '@/contexts/LanguageContext';

export function ReviewQueuePanel() {
  const { t } = useLanguage();
  const { items, loading, resolve } = useDoor3ReviewQueue();

  const tLane = (lane: string) => t(`portal.documents.door3.lane.${lane}`) || lane;
  const tReason = (reason: string) => t(`portal.documents.door3.reason.${reason}`) || reason;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('portal.documents.door3.reviewQueueTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">{t('portal.documents.door3.loading')}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded">
            {t('portal.documents.door3.noReviewItems')}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="border border-border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{tLane(it.lane)}</Badge>
                    <span className="text-xs text-muted-foreground">{tReason(it.reason)}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date(it.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs font-mono text-muted-foreground break-all">
                  {t('portal.documents.door3.document')}: {it.document_id}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => resolve(it.id, 'approved')}>
                    {t('portal.documents.door3.approve')}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => resolve(it.id, 'rejected')}>
                    {t('portal.documents.door3.reject')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolve(it.id, 'keep_needs_review')}>
                    {t('portal.documents.door3.keepNeedsReview')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
