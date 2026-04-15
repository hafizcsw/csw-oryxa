/**
 * University Dashboard - Readiness Pipeline
 * Shows applicant segmentation by readiness status
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, CheckCircle, AlertTriangle, Clock, XCircle, TrendingUp, FileText, Globe, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PipelineSegment {
  segment: 'ready_now' | 'conditionally_eligible' | 'trainable' | 'blocked';
  count: number;
  label_key: string;
  percentage: number;
}

interface MissingRequirement {
  requirement_key: string;
  count: number;
  percentage: number;
  icon: 'globe' | 'book' | 'file' | 'dollar';
}

interface ReadinessPipelineProps {
  segments?: PipelineSegment[];
  missingRequirements?: MissingRequirement[];
  totalApplicants?: number;
  className?: string;
}

const SEGMENT_CONFIG = {
  ready_now: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', bar: 'bg-emerald-500' },
  conditionally_eligible: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', bar: 'bg-amber-500' },
  trainable: { icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', bar: 'bg-blue-500' },
  blocked: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', bar: 'bg-red-500' },
};

const ICON_MAP = {
  globe: Globe,
  book: BookOpen,
  file: FileText,
  dollar: Users,
};

export function ReadinessPipeline({ segments, missingRequirements, totalApplicants, className }: ReadinessPipelineProps) {
  const { t } = useLanguage();
  
  const displaySegments = segments && segments.length > 0 ? segments : [];
  const total = totalApplicants ?? displaySegments.reduce((s, seg) => s + seg.count, 0);
  const hasData = total > 0 && displaySegments.length > 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Pipeline Overview */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t('pipeline.title')}
          </h3>
          <Badge variant="outline" className="text-xs">
            {total} {t('pipeline.total_applicants')}
          </Badge>
        </div>

        {/* Pipeline Bar */}
        {hasData && (
          <div className="h-3 rounded-full bg-muted overflow-hidden flex">
            {displaySegments.map(seg => {
              const config = SEGMENT_CONFIG[seg.segment];
              const width = total > 0 ? (seg.count / total) * 100 : 0;
              if (width === 0) return null;
              return (
                <div
                  key={seg.segment}
                  className={cn('h-full transition-all', config.bar)}
                  style={{ width: `${width}%` }}
                />
              );
            })}
          </div>
        )}

        {hasData ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {displaySegments.map(seg => {
              const config = SEGMENT_CONFIG[seg.segment];
              const Icon = config.icon;
              return (
                <div key={seg.segment} className="p-3 rounded-xl border border-border space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', config.bg)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{seg.count}</p>
                  <p className="text-xs text-muted-foreground">{t(seg.label_key)}</p>
                  {seg.percentage > 0 && (
                    <p className="text-xs text-muted-foreground">{seg.percentage}%</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2 italic">
            {t('pipeline.no_data')}
          </p>
        )}
      </div>

      {/* Common Missing Requirements */}
      {missingRequirements && missingRequirements.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('pipeline.common_gaps')}
          </h3>
          <div className="space-y-3">
            {missingRequirements.map((req, i) => {
              const Icon = ICON_MAP[req.icon] || FileText;
              return (
                <div key={i} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{t(req.requirement_key)}</span>
                      <span className="text-muted-foreground">{req.count} ({req.percentage}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${req.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
