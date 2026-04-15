import { Paperclip, RefreshCw, Copy, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface DocumentVaultHeaderProps {
  totalRequired: number;
  completedRequired: number;
  isLocked?: boolean;
  lockReason?: string | null;
  duplicatesCount?: number;
  onRefresh: () => void;
  onDeleteDuplicates?: () => void;
  isRefreshing?: boolean;
}

export function DocumentVaultHeader({
  totalRequired,
  completedRequired,
  isLocked,
  lockReason,
  duplicatesCount = 0,
  onRefresh,
  onDeleteDuplicates,
  isRefreshing,
}: DocumentVaultHeaderProps) {
  const { t } = useLanguage();
  const progress = totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0;
  const isComplete = completedRequired >= totalRequired;

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-3 rounded-xl",
            isComplete ? "bg-emerald-500/10" : "bg-primary/10"
          )}>
            <Paperclip className={cn(
              "h-6 w-6",
              isComplete ? "text-emerald-500" : "text-primary"
            )} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('portal.documents.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {isComplete 
                ? t('portal.documents.allDocsComplete')
                : t('portal.documents.docsProgress').replace('{completed}', String(completedRequired)).replace('{total}', String(totalRequired))
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {duplicatesCount > 0 && onDeleteDuplicates && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onDeleteDuplicates}
              className="gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">{t('portal.documents.deleteDuplicates')}</span>
              <span>({duplicatesCount})</span>
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh} 
            disabled={isRefreshing}
            className="gap-2"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{t('portal.documents.refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress 
          value={progress} 
          className={cn(
            "h-2",
            isComplete && "[&>div]:bg-emerald-500"
          )}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('portal.documents.requiredDocs')}</span>
          <span className={cn(
            "font-medium",
            isComplete ? "text-emerald-600" : "text-primary"
          )}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Lock Banner */}
      {isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-600 dark:text-amber-400">
              {t('portal.documents.lockedByAdmin')}
            </h4>
            {lockReason && (
              <p className="text-sm text-muted-foreground mt-1">
                {t('portal.documents.lockReason')}: {lockReason}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
