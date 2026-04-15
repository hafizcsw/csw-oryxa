import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AssessmentAttemptSummary } from '@/components/languages/assessment/AssessmentAttemptSummary';
import { AssessmentSectionRenderer } from '@/components/languages/assessment/AssessmentSectionRenderer';
import { AssessmentSubmitBar } from '@/components/languages/assessment/AssessmentSubmitBar';
import type { RussianAssessmentLatestAttemptSummary, RussianAssessmentSection } from '@/types/russianAssessmentExecution';

interface Props {
  title: string;
  version: string;
  statusLabel: string;
  scoreTarget: number | null;
  latestAttempt: RussianAssessmentLatestAttemptSummary;
  sections: RussianAssessmentSection[];
  loading?: boolean;
  onSubmit: (answers: Record<string, string>, durationSeconds: number) => Promise<void> | void;
}

export function AssessmentRunner({ title, version, statusLabel, scoreTarget, latestAttempt, sections, loading = false, onSubmit }: Props) {
  const { t } = useLanguage();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => Date.now());

  const totalItems = useMemo(() => sections.reduce((sum, section) => sum + section.itemCount, 0), [sections]);
  const answeredCount = useMemo(() => Object.values(answers).filter((value) => value.trim().length >= 3).length, [answers]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('languages.assessment.runnerLabel')}</p>
            <h1 className="text-2xl font-bold text-foreground mt-1">{title}</h1>
            <p className="text-sm text-muted-foreground mt-2">{t('languages.assessment.versionLabel', { version })}</p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t('languages.assessment.statusLabel', { status: statusLabel })}</p>
            {scoreTarget !== null && <p>{t('languages.assessment.targetLabel', { score: scoreTarget })}</p>}
          </div>
        </div>
        <AssessmentAttemptSummary latestAttempt={latestAttempt} />
      </div>

      {sections.map((section) => (
        <AssessmentSectionRenderer
          key={section.key}
          section={section}
          answers={answers}
          onChange={(itemKey, value) => setAnswers((prev) => ({ ...prev, [itemKey]: value }))}
          disabled={loading}
        />
      ))}

      <AssessmentSubmitBar
        answeredCount={answeredCount}
        totalItems={totalItems}
        loading={loading}
        onSubmit={() => onSubmit(answers, Math.max(1, Math.round((Date.now() - startedAt) / 1000)))}
      />
    </div>
  );
}
