import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { DSButton } from '@/components/design-system/DSButton';
import { AssessmentRunner } from '@/components/languages/assessment/AssessmentRunner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLearningState } from '@/hooks/useLearningState';
import { useRussianActivation } from '@/hooks/useRussianActivation';
import { useRussianCheckpointLaunch } from '@/hooks/useRussianCheckpointLaunch';
import { useRussianCheckpointSubmit } from '@/hooks/useRussianCheckpointSubmit';
import { useToast } from '@/hooks/use-toast';
import type { RussianCheckpointTemplateKey } from '@/types/russianAssessmentExecution';
import { RTL_LANGUAGES } from '@/i18n/languages';
import { translateLanguageCourseValue } from '@/lib/languageCourseI18n';

export default function RussianCheckpoint() {
  const { templateKey } = useParams<{ templateKey: RussianCheckpointTemplateKey }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { loading: activationLoading, isActivated } = useRussianActivation();
  const { userId, loading: learningLoading } = useLearningState();
  const { data, loading, error } = useRussianCheckpointLaunch(userId, (templateKey ?? 'shared_core_checkpoint_01_v1') as RussianCheckpointTemplateKey);
  const { submit, loading: submitLoading } = useRussianCheckpointSubmit(userId);
  const BackArrow = RTL_LANGUAGES.includes(language as never) ? ArrowRight : ArrowLeft;
  const formatStatusLabel = (status: string) => translateLanguageCourseValue(t, `languages.assessment.status.${status}`, status);

  useEffect(() => {
    if (activationLoading || learningLoading) return;
    if (!userId) {
      navigate('/languages/russian/dashboard', { replace: true });
      return;
    }
    if (!isActivated) {
      navigate('/languages/russian/dashboard', { replace: true });
      return;
    }
    if (templateKey && templateKey !== 'shared_core_checkpoint_01_v1') {
      navigate('/languages/russian/dashboard', { replace: true });
    }
  }, [activationLoading, learningLoading, isActivated, navigate, userId, templateKey]);

  useEffect(() => {
    if (error === 'checkpoint_launch_locked' || error === 'checkpoint_template_not_supported') {
      navigate('/languages/russian/dashboard', { replace: true });
    }
  }, [error, navigate]);

  if (activationLoading || learningLoading || loading || !data) return null;

  return (
    <Layout>
      <div className="min-h-[80vh] bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
          <DSButton variant="ghost" size="sm" onClick={() => navigate('/languages/russian/dashboard')} className="gap-1.5">
            <BackArrow className="h-4 w-4" />
            {t('languages.dashboard.backToDashboard')}
          </DSButton>

          <AssessmentRunner
            title={data.title}
            version={data.version}
            statusLabel={formatStatusLabel(data.status)}
            scoreTarget={data.passingScore}
            latestAttempt={data.latestAttempt}
            sections={data.sections}
            loading={submitLoading}
            onSubmit={async (answers, durationSeconds) => {
              const result = await submit({ templateKey: data.templateKey, answersJson: answers, durationSeconds });
              toast({
                title: t('languages.assessment.submitSuccessTitle'),
                description: t(result.passed ? 'languages.assessment.checkpointPassedDesc' : 'languages.assessment.checkpointRetryDesc'),
              });
              navigate('/languages/russian/dashboard', { replace: true });
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
