import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Lock, PlayCircle } from 'lucide-react';
import { DSButton } from '@/components/design-system/DSButton';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DashboardPayload } from '@/types/russianExecutionPack';

interface Props {
  dashboardData: DashboardPayload;
}

export function ExamLaunchCard({ dashboardData }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const canLaunch = ['eligible', 'unlocked', 'completed'].includes(dashboardData.exam.status);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('languages.assessment.examLaunchTitle')}</p>
          <p className="text-sm text-foreground mt-1">{t('languages.assessment.examLaunchDesc')}</p>
        </div>
        {dashboardData.exam.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : dashboardData.exam.status === 'locked' ? <Lock className="h-5 w-5 text-muted-foreground" /> : <PlayCircle className="h-5 w-5 text-primary" />}
      </div>
      <p className="text-xs text-muted-foreground">{t('languages.assessment.examStateLabel', { status: dashboardData.exam.status.replace(/_/g, ' ') })}</p>
      <DSButton
        variant={canLaunch ? 'primary' : 'outline'}
        disabled={!canLaunch}
        onClick={() => navigate(`/languages/russian/exams/${dashboardData.exam.nextExamSetKey}`)}
      >
        {dashboardData.exam.status === 'completed' ? t('languages.assessment.reviewExam') : t('languages.assessment.startExam')}
      </DSButton>
    </div>
  );
}
