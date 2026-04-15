import { University } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, RefreshCw, MapPin, Clock, DollarSign, Languages } from 'lucide-react';
import { filterValidPrograms, getProgramDisplayInfo, getProgramId } from '@/lib/program/validators';
import { useCountryName } from '@/hooks/useCountryName';
import { useLanguage } from '@/contexts/LanguageContext';

interface UniversityResultsProps {
  universities: University[];
  onLike: (universityId: string) => void;
  onApply?: (universityId: string) => void;
  onRequestAlternatives: () => void;
}

export function UniversityResults({ universities, onLike, onApply, onRequestAlternatives }: UniversityResultsProps) {
  const { t } = useLanguage();
  const { getCountryName } = useCountryName();
  const validUniversities = filterValidPrograms(universities);
  if (validUniversities.length === 0) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {t('botUi.suggestedUniversities')}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onRequestAlternatives}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('botUi.requestAlternatives')}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {validUniversities.map((uni) => {
          const programId = getProgramId(uni);
          const info = getProgramDisplayInfo(uni);
          return (
          <Card key={programId} className="p-4 space-y-3 hover:shadow-md transition-shadow">
            <div>
              <h4 className="font-semibold text-foreground line-clamp-1">
                {info.universityName}
              </h4>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {info.programName}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>{getCountryName((uni as any).country_code || (uni as any).country_slug || '', info.countryName)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Languages className="w-3.5 h-3.5" />
                <span>{info.language}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="w-3.5 h-3.5" />
                <span>${Number(info.fees || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>{t('botUi.durationYears', { years: Math.round(Number(info.duration || 0) / 12) })}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => onLike(programId)}
              >
                <Heart className="w-4 h-4" />
                {t('botUi.like')}
              </Button>
              
              {onApply && (
                <Button
                  size="sm"
                  className="flex-1 gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                  onClick={() => onApply(programId)}
                >
                  {t('botUi.apply')}
                </Button>
              )}
            </div>
          </Card>
        );
        })}
      </div>
    </div>
  );
}
