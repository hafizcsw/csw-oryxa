import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowRight, Building2, GraduationCap, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AlternativeRoute } from '@/features/readiness/types';

interface AlternativeRoutesProps {
  alternatives: AlternativeRoute[];
  unavailableReasonKey?: string;
  onExplore?: (alt: AlternativeRoute) => void;
}

const TYPE_ICONS = {
  same_university_pathway: GraduationCap,
  alternative_program: MapPin,
  alternative_university: Building2,
};

export function AlternativeRoutes({ alternatives, unavailableReasonKey, onExplore }: AlternativeRoutesProps) {
  const { t } = useLanguage();

  if (alternatives.length === 0) {
    if (!unavailableReasonKey) return null;
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{t('readiness.alternatives.title')}</h3>
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          {t(unavailableReasonKey)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">{t('readiness.alternatives.title')}</h3>
      <div className="space-y-2">
        {alternatives.map((alt, i) => {
          const Icon = TYPE_ICONS[alt.type];
          return (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">
                  {alt.university_name || alt.program_title || t(`readiness.alternatives.type.${alt.type}`)}
                </p>
                <p className="text-sm text-muted-foreground">{t(alt.reason_key)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onExplore?.(alt)} className="gap-1 shrink-0">
                {t('readiness.alternatives.explore')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
