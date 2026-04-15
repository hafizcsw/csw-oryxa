import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type QualityLevel = 'hd' | 'standard' | 'lq';

interface QualityInfo {
  level: QualityLevel;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  progressClass: string;
}

function getQualityLevel(score: number): QualityInfo {
  if (score >= 0.8) {
    return {
      level: 'hd',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
      borderClass: 'border-emerald-500/50',
      progressClass: 'bg-emerald-500',
    };
  }
  if (score >= 0.5) {
    return {
      level: 'standard',
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-100 dark:bg-amber-900/30',
      borderClass: 'border-amber-500/50',
      progressClass: 'bg-amber-500',
    };
  }
  return {
    level: 'lq',
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    borderClass: 'border-red-500/50',
    progressClass: 'bg-red-500',
  };
}

interface QualityBadgeProps {
  score: number; // 0.0 - 1.0
  showPercentage?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function QualityBadge({
  score,
  showPercentage = true,
  size = 'sm',
  className,
}: QualityBadgeProps) {
  const { t } = useTranslation('translation');
  const displayScore = Math.round(score * 100);
  const quality = getQualityLevel(score);

  const Icon = quality.level === 'hd' ? Sparkles : quality.level === 'lq' ? AlertTriangle : null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        quality.bgClass,
        quality.borderClass,
        quality.colorClass,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
        className
      )}
    >
      {Icon && <Icon className={cn('h-3 w-3', size === 'md' && 'h-3.5 w-3.5')} />}
      <span>{t(`unified.qualityBadge${quality.level.toUpperCase()}`)}</span>
      {showPercentage && <span className="opacity-75">{displayScore}%</span>}
    </Badge>
  );
}

interface QualityProgressProps {
  score: number; // 0.0 - 1.0
  showDescription?: boolean;
  className?: string;
}

export function QualityProgress({
  score,
  showDescription = true,
  className,
}: QualityProgressProps) {
  const { t } = useTranslation('translation');
  const displayScore = Math.round(score * 100);
  const quality = getQualityLevel(score);

  const getDescription = () => {
    switch (quality.level) {
      case 'hd':
        return t('unified.qualitySuitableForTranslation');
      case 'standard':
        return t('unified.qualityMayAffectAccuracy');
      case 'lq':
        return t('unified.qualityNeedsImprovement');
    }
  };

  const Icon = quality.level === 'hd' ? Check : quality.level === 'lq' ? AlertTriangle : null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {t('unified.qualityScore')}
        </span>
        <QualityBadge score={score} showPercentage={true} size="sm" />
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full transition-all duration-500', quality.progressClass)}
          style={{ width: `${displayScore}%` }}
        />
      </div>

      {showDescription && (
        <div className={cn('flex items-center gap-1.5 text-xs', quality.colorClass)}>
          {Icon && <Icon className="h-3 w-3" />}
          <span>{getDescription()}</span>
        </div>
      )}
    </div>
  );
}

export { getQualityLevel, type QualityLevel, type QualityInfo };
