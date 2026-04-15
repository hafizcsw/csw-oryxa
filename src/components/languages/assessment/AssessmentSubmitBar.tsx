import { Loader2, Send } from 'lucide-react';
import { DSButton } from '@/components/design-system/DSButton';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  answeredCount: number;
  totalItems: number;
  loading: boolean;
  onSubmit: () => void;
}

export function AssessmentSubmitBar({ answeredCount, totalItems, loading, onSubmit }: Props) {
  const { t } = useLanguage();

  return (
    <div className="sticky bottom-4 z-10 rounded-2xl border border-border bg-card/95 backdrop-blur p-4 shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{t('languages.assessment.progressLabel', { answered: answeredCount, total: totalItems })}</p>
          <p className="text-xs text-muted-foreground">{t('languages.assessment.scoringNote')}</p>
        </div>
        <DSButton onClick={onSubmit} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? t('languages.assessment.submitting') : t('languages.assessment.submit')}
        </DSButton>
      </div>
    </div>
  );
}
