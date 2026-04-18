// ═══════════════════════════════════════════════════════════════
// EngineActivityStrip — Visible "what is the engine doing" surface
// ═══════════════════════════════════════════════════════════════
// The student no longer sees a silent spinning orb. This strip
// lists every document currently in flight, the stage the engine
// is on, an optional truthful detail (file size, page count, MRZ
// format, # of fields), and elapsed ms. It auto-clears 4.5s after
// each document completes (handled in useDocumentAnalysis).
// No fake AI claims. No invented progress %. Pure stage truth.
// ═══════════════════════════════════════════════════════════════

import { useLanguage } from '@/contexts/LanguageContext';
import type { LiveStageState } from '@/hooks/useDocumentAnalysis';
import {
  FileText,
  ScanLine,
  Tags,
  Fingerprint,
  Sparkles,
  ListOrdered,
  Layers,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EngineActivityStripProps {
  liveStages: Record<string, LiveStageState>;
}

const STAGE_ICON: Record<LiveStageState['stage'], React.ComponentType<{ className?: string }>> = {
  reading: FileText,
  ocr: ScanLine,
  classifying: Tags,
  mrz: Fingerprint,
  extracting: Sparkles,
  transcript_rows: ListOrdered,
  building_proposals: Layers,
  completed: CheckCircle2,
  failed: XCircle,
};

const STAGE_TONE: Record<LiveStageState['stage'], string> = {
  reading: 'text-sky-500',
  ocr: 'text-violet-500',
  classifying: 'text-amber-500',
  mrz: 'text-fuchsia-500',
  extracting: 'text-primary',
  transcript_rows: 'text-cyan-500',
  building_proposals: 'text-indigo-500',
  completed: 'text-emerald-500',
  failed: 'text-destructive',
};

export function EngineActivityStrip({ liveStages }: EngineActivityStripProps) {
  const { t } = useLanguage();
  const items = Object.values(liveStages).sort((a, b) => b.updated_at - a.updated_at);
  if (items.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-3 shadow-sm"
      role="status"
      aria-live="polite"
      data-testid="engine-activity-strip"
    >
      <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <span>{String(t('portal.analysis.engine.title') ?? 'Engine activity')}</span>
      </div>

      <ul className="space-y-1.5">
        {items.map((it) => {
          const Icon = STAGE_ICON[it.stage] ?? FileText;
          const tone = STAGE_TONE[it.stage] ?? 'text-foreground';
          const isTerminal = it.stage === 'completed' || it.stage === 'failed';
          const stageLabel = String(
            t(`portal.analysis.engine.stage.${it.stage}`) ?? it.stage,
          );
          return (
            <li
              key={it.documentId}
              className={cn(
                'flex items-center gap-2 text-xs rounded-md px-2 py-1.5',
                'bg-muted/40 hover:bg-muted/60 transition-colors',
              )}
              data-stage={it.stage}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  tone,
                  !isTerminal && 'animate-pulse',
                )}
              />
              <span className="font-medium text-foreground truncate max-w-[18rem]" title={it.filename}>
                {it.filename}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className={cn('font-medium', tone)}>{stageLabel}</span>
              {it.detail && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground truncate" dir="ltr">{it.detail}</span>
                </>
              )}
              <span className="ms-auto text-[10px] tabular-nums text-muted-foreground">
                {(it.elapsed_ms / 1000).toFixed(1)}s
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
