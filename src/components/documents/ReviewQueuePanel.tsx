// ═══════════════════════════════════════════════════════════════
// ReviewQueuePanel — Door 3 review surface
// ═══════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDoor3ReviewQueue } from '@/features/documents/door3/hooks/useDoor3ReviewQueue';

export function ReviewQueuePanel() {
  const { items, loading, resolve } = useDoor3ReviewQueue();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review queue — Door 3</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded">
            No items pending review.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="border border-border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{it.lane}</Badge>
                    <span className="text-xs text-muted-foreground">{it.reason}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date(it.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs font-mono text-muted-foreground break-all">
                  doc: {it.document_id}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => resolve(it.id, 'approved')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => resolve(it.id, 'rejected')}>
                    Reject
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolve(it.id, 'keep_needs_review')}>
                    Keep needs review
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
