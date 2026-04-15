import { Layout } from '@/components/layout/Layout';
import { DSButton } from '@/components/design-system/DSButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLanguageCourseDefinition } from '@/lib/languageCourseConfig';
import { RTL_LANGUAGES } from '@/i18n/languages';
import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function LanguageCourseComingSoon() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { languageKey = '' } = useParams<{ languageKey: string }>();
  const course = useMemo(() => getLanguageCourseDefinition(languageKey), [languageKey]);
  const isRtl = RTL_LANGUAGES.includes(language as never);
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  if (!course || course.hasRuntime) return null;

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-xl w-full rounded-3xl border border-border bg-card p-8 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
            {course.flag}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t('languages.comingSoon')}</p>
            <h1 className="text-3xl font-bold text-foreground">{t(course.catalogNameKey)}</h1>
            <p className="text-sm text-muted-foreground">{t('languages.catalogComingSoonMessage', { language: t(course.catalogNameKey) })}</p>
            <p className="text-sm text-muted-foreground">{t(course.catalogDescKey)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-3 text-start">
            <Clock3 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>{t('languages.catalogComingSoonDetail')}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <DSButton onClick={() => navigate('/languages/russian/onboarding')}>{t('languages.catalogPrimaryCta')}</DSButton>
            <DSButton variant="outline" onClick={() => navigate('/languages')} className="gap-2">
              <BackArrow className="h-4 w-4" />
              {t('languages.catalogSecondaryCta')}
            </DSButton>
          </div>
        </div>
      </div>
    </Layout>
  );
}
