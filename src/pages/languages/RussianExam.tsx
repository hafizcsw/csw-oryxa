import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { DSButton } from '@/components/design-system/DSButton';
import { AssessmentRunner } from '@/components/languages/assessment/AssessmentRunner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLearningState } from '@/hooks/useLearningState';
import { useRussianActivation } from '@/hooks/useRussianActivation';
import { useRussianExamLaunch } from '@/hooks/useRussianExamLaunch';
import { useRussianExamSubmit } from '@/hooks/useRussianExamSubmit';
import { useToast } from '@/hooks/use-toast';
import type { RussianExamSetKey } from '@/types/russianAssessmentExecution';
import { isRussianIntensiveExamKey } from '@/lib/russianIntensive750AssessmentRuntime';
import { RTL_LANGUAGES } from '@/i18n/languages';
import { translateLanguageCourseValue } from '@/lib/languageCourseI18n';

export default function RussianExam() {
  const { examSetKey } = useParams<{ examSetKey: RussianExamSetKey }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { loading: activationLoading, isActivated } = useRussianActivation();
  const { userId, loading: learningLoading } = useLearningState();
  const { data, loading, error } = useRussianExamLaunch(userId, (examSetKey ?? 'shared_core_exam_set_01_v1') as RussianExamSetKey);
  const { submit, loading: submitLoading } = useRussianExamSubmit(userId);
  const BackArrow = RTL_LANGUAGES.includes(language as never) ? ArrowRight : ArrowLeft;
  const formatStatusLabel = (status: string) => translateLanguageCourseValue(t, `languages.assessment.status.${status}`, status);

  useEffect(() => {
    if (activationLoading || learningLoading) return;
    if (!userId) {
      navigate('/languages/russian/dashboard?tab=exams', { replace: true });
      return;
    }
    if (!isActivated) {
      navigate('/languages/russian/dashboard?tab=exams', { replace: true });
      return;
    }
    if (examSetKey && examSetKey !== 'shared_core_exam_set_01_v1' && !isRussianIntensiveExamKey(examSetKey)) {
      navigate('/languages/russian/dashboard?tab=exams', { replace: true });
    }
  }, [activationLoading, learningLoading, isActivated, navigate, userId, examSetKey]);

  useEffect(() => {
    if (error === 'exam_launch_locked' || error === 'exam_set_not_supported') {
      navigate('/languages/russian/dashboard?tab=exams', { replace: true });
    }
  }, [error, navigate]);

  if (activationLoading || learningLoading || loading || !data) return null;

  return (
    <Layout>
      <div className="min-h-[80vh] bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
          <DSButton variant="ghost" size="sm" onClick={() => navigate('/languages/russian/dashboard?tab=exams')} className="gap-1.5">
            <BackArrow className="h-4 w-4" />
            {t('languages.dashboard.backToExams')}
          </DSButton>

          <AssessmentRunner
            title={data.title}
            version={data.version}
            statusLabel={formatStatusLabel(data.status)}
            scoreTarget={data.targetScore}
            latestAttempt={data.latestAttempt}
            sections={data.sections}
            loading={submitLoading}
            onSubmit={async (answers, durationSeconds) => {
              const result = await submit({ examSetKey: data.examSetKey, answersJson: answers, durationSeconds });
              toast({
                title: t('languages.assessment.submitSuccessTitle'),
                description: t(result.passed ? 'languages.assessment.examPassedDesc' : 'languages.assessment.examRetryDesc'),
              });
              navigate('/languages/russian/dashboard?tab=exams', { replace: true });
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
