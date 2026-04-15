import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PREP_SERVICES } from '@/features/readiness/services';
import type { GapCategory } from '@/features/readiness/types';

interface PrepServiceGridProps {
  highlightCategories?: GapCategory[];
  focusedServiceId?: string | null;
  onServiceClick?: (serviceId: string) => void;
}

export function PrepServiceGrid({ highlightCategories, focusedServiceId, onServiceClick }: PrepServiceGridProps) {
  const { t } = useLanguage();

  // Sort: highlighted first, then available, then coming soon
  const sorted = [...PREP_SERVICES].sort((a, b) => {
    const aHighlighted = highlightCategories?.some(c => a.linked_gap_categories.includes(c)) ? 0 : 1;
    const bHighlighted = highlightCategories?.some(c => b.linked_gap_categories.includes(c)) ? 0 : 1;
    if (aHighlighted !== bHighlighted) return aHighlighted - bHighlighted;
    if (a.available !== b.available) return a.available ? -1 : 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{t('readiness.services.title')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map(service => {
          const isHighlighted = highlightCategories?.some(c => service.linked_gap_categories.includes(c));
          const isFocused = focusedServiceId === service.id;
          return (
            <div
              key={service.id}
              data-testid={`prep-service-${service.id}`}
              className={cn(
                'rounded-xl border p-5 space-y-3 transition-all',
                (isHighlighted || isFocused) ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card',
                service.coming_soon && 'opacity-75'
              )}
            >
              <div className="flex items-start justify-between">
                <h4 className="font-semibold text-foreground">{t(service.title_key)}</h4>
                {isHighlighted && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {t('readiness.services.recommended')}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{t(service.description_key)}</p>

              <ul className="space-y-1">
                {service.features_keys.map(fk => (
                  <li key={fk} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-primary rounded-full shrink-0" />
                    {t(fk)}
                  </li>
                ))}
              </ul>

              {service.coming_soon ? (
                <Button variant="outline" size="sm" disabled className="w-full gap-2">
                  <Clock className="h-4 w-4" />
                  {t('readiness.services.coming_soon')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={isHighlighted ? 'default' : 'outline'}
                  className="w-full gap-2"
                  onClick={() => onServiceClick?.(service.id)}>
                  {t(service.cta_key)}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
