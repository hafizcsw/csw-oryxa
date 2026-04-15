import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Lock, PlayCircle } from 'lucide-react';
import { DSButton } from '@/components/design-system/DSButton';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DashboardPayload } from '@/types/russianExecutionPack';

interface Props {
  dashboardData: DashboardPayload;
}

export function CheckpointLaunchCard({ dashboardData }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const canLaunch = ['eligible', 'unlocked', 'passed'].includes(dashboardData.checkpoint.status);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('languages.assessment.checkpointLaunchTitle')}</p>
          <p className="text-sm text-foreground mt-1">{t('languages.assessment.checkpointLaunchDesc')}</p>
        </div>
        {dashboardData.checkpoint.status === 'passed' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : dashboardData.checkpoint.status === 'locked' ? <Lock className="h-5 w-5 text-muted-foreground" /> : <PlayCircle className="h-5 w-5 text-primary" />}
      </div>
      <p className="text-xs text-muted-foreground">{t('languages.assessment.checkpointStateLabel', { status: dashboardData.checkpoint.status.replace(/_/g, ' ') })}</p>
      <DSButton
        variant={canLaunch ? 'primary' : 'outline'}
        disabled={!canLaunch}
        onClick={() => navigate(`/languages/russian/checkpoints/${dashboardData.checkpoint.nextTemplateKey}`)}
      >
        {dashboardData.checkpoint.status === 'passed' ? t('languages.assessment.reviewCheckpoint') : t('languages.assessment.startCheckpoint')}
      </DSButton>
    </div>
  );
}
