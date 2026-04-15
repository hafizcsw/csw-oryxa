/**
 * Page analytics panel — shows only verifiable data.
 * Currently: published_posts count + inbox_threads count from real DB.
 * Event-based analytics tracking is NOT yet wired from frontend,
 * so event breakdowns are hidden until that data flow exists.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, MessageCircle, FileText, Loader2, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface PageAnalyticsPanelProps {
  universityId: string;
}

interface AnalyticsSummary {
  period_days: number;
  events: Record<string, number>;
  total_events: number;
  published_posts: number;
  inbox_threads: number;
}

export function PageAnalyticsPanel({ universityId }: PageAnalyticsPanelProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'analytics.summary', university_id: universityId, days: 30 } });
      if (data?.ok) setSummary(data.summary || null);
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('pageOS.analytics.title')}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAnalytics} className="h-8 w-8 p-0">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Only show verifiable counts from real DB queries */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <FileText className="h-5 w-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{summary?.published_posts || 0}</div>
          <div className="text-xs text-muted-foreground">{t('pageOS.analytics.publishedPosts')}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <MessageCircle className="h-5 w-5 text-green-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{summary?.inbox_threads || 0}</div>
          <div className="text-xs text-muted-foreground">{t('pageOS.analytics.inboxThreads')}</div>
        </div>
      </div>

      {/* Honest notice about event-based analytics */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-sm text-muted-foreground">
            {t('pageOS.analytics.trackingNotice')}
          </p>
        </div>
      </div>
    </div>
  );
}
