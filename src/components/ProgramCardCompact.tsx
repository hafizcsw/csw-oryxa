import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GraduationCap, MapPin, DollarSign, Clock, X, Loader2 } from "lucide-react";
import { useLocalizedField } from "@/hooks/useLocalizedField";
import { useTranslation } from "react-i18next";
import { useDeterministicLocalizer } from "@/hooks/useDeterministicLocalizer";
import { useCountryName } from "@/hooks/useCountryName";
import { resolveCountrySlugByName } from "@/lib/country/resolveCountrySlugByName";
import { useGuestAwareShortlist } from "@/hooks/useGuestShortlist";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProgramCardCompactProps {
  program: {
    program_id: string;
    program_name?: string;
    program_name_en?: string;
    program_name_ar?: string;
    title?: string;
    title_en?: string;
    title_ar?: string;
    university_name?: string;
    university_name_en?: string;
    university_name_ar?: string;
    university_logo_url?: string;
    logo_url?: string;
    country?: string;
    country_name?: string;
    country_name_en?: string;
    country_name_ar?: string;
    country_slug?: string;
    tuition_usd?: number;
    tuition_min?: number;
    fees_yearly?: number;
    currency_code?: string;
    duration_months?: number;
    degree_level?: string;
    degree_name?: string;
    degree_name_ar?: string;
    degree_name_en?: string;
    discipline_name?: string;
    discipline_name_ar?: string;
    discipline_name_en?: string;
  };
  onDetails: (id: string) => void;
  showHeart?: boolean;
}

/** Inline remove button for shortlist panel */
function ShortlistRemoveInline({ programId }: { programId: string }) {
  const { remove, isRemoving } = useGuestAwareShortlist();
  const [removing, setRemoving] = useState(false);
  const busy = isRemoving || removing;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setRemoving(true);
    await remove(programId);
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="absolute top-2 end-2 z-10 rounded-full bg-white/90 dark:bg-slate-900/90 hover:bg-destructive hover:text-destructive-foreground p-1 transition-all shadow-sm hover:scale-110 disabled:opacity-50"
      aria-label="إزالة من المفضلة"
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <X className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );
}

export function ProgramCardCompact({ program, onDetails, showHeart = false }: ProgramCardCompactProps) {
  const { getField, getFieldMeta, hasLegacyNativeField, isResolverDisplaySource, language } = useLocalizedField();
  const { t } = useTranslation();
  const { localize } = useDeterministicLocalizer();
  const { getCountryName } = useCountryName();

  // Resolve localized fields (display-first via adapter; legacy suffix fallback remains contained)
  const programNameMeta = getFieldMeta(program as any, 'program_name');
  const baseTitle = programNameMeta.value || getField(program, 'title') || '';
  
  // Try deterministic localization for AR only on legacy fallback values
  let programName = baseTitle;
  const isResolverResolvedProgramName = isResolverDisplaySource(program as any, 'program_name');
  if (language === 'ar' && baseTitle && !isResolverResolvedProgramName && !hasLegacyNativeField(program as any, 'program_name')) {
    const result = localize(baseTitle);
    if (result.level === 'HIGH' && result.localized) {
      programName = result.localized;
    }
  }
  if (!programName) programName = t('program.unknown');
  const universityName = getField(program, 'university_name') || t('university.unknown');
  // Country: prefer dictionary lookup by slug, then localized adapter fallback
  const countryFieldFallback = getField(program as any, 'country_name') || program.country || "";
  const resolvedCountrySlug = program.country_slug || resolveCountrySlugByName(countryFieldFallback);
  const country = resolvedCountrySlug
    ? getCountryName(resolvedCountrySlug, countryFieldFallback)
    : countryFieldFallback;
  
  // Degree name: explicit locale resolution with fallback chain
  const degreeName = getField(program, 'degree_name') || program.degree_level || "";
  
  // Discipline name: explicit locale resolution
  const disciplineName = getField(program, 'discipline_name') || "";
  
  // Money semantics (unit-safe):
  // - fees_yearly uses original currency_code when available.
  // - tuition_usd / tuition_min are USD-valued fields.
  const tuitionAmount = program.fees_yearly ?? program.tuition_usd ?? program.tuition_min;
  const tuitionCurrency = program.fees_yearly != null ? program.currency_code : 'USD';
  const logoUrl = program.university_logo_url || program.logo_url;
  const firstLetter = universityName.charAt(0).toUpperCase();

  // Format money - no fake/default currency fallback
  const formatMoney = (amount?: number, currencyCode?: string | null): string => {
    if (amount == null) return "—";
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';
    if (currencyCode) {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currencyCode,
          maximumFractionDigits: 0,
        }).format(amount);
      } catch {
        // Invalid currency — plain localized number
      }
    }
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
  };

  // Format duration with locale
  const formatDuration = (months?: number): string => {
    if (!months) return "—";
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (language === 'ar') {
      if (years === 0) return `${months} شهر`;
      if (remainingMonths === 0) {
        return years === 1 ? 'سنة واحدة' : years === 2 ? 'سنتان' : `${years} سنوات`;
      }
      return `${years} سنة و ${remainingMonths} شهر`;
    } else {
      if (years === 0) return `${months} months`;
      if (remainingMonths === 0) {
        return years === 1 ? '1 year' : `${years} years`;
      }
      return `${years}y ${remainingMonths}m`;
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border hover:shadow-lg transition-shadow duration-200 flex flex-col h-full min-h-[280px]">
      {/* Header with gradient */}
      <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5 relative flex items-center justify-center">
        <GraduationCap className="w-10 h-10 text-primary/40" />
        {showHeart && program.program_id && (
          <ShortlistRemoveInline programId={program.program_id} />
        )}
        {degreeName && (
          <span className={`absolute top-2 ${showHeart ? 'start-2' : 'left-2'} text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full`}>
            {degreeName}
          </span>
        )}
        {disciplineName && !showHeart && (
          <span className="absolute top-2 right-2 text-xs bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full">
            {disciplineName}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Logo + Names */}
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10 border border-border shrink-0">
            <AvatarImage src={logoUrl} alt={universityName} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {firstLetter}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight min-h-[2.5rem]">
              {programName}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {universityName}
            </p>
          </div>
        </div>

        {/* Quick Info */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground min-h-[32px]">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {country || "—"}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {formatMoney(tuitionAmount, tuitionCurrency)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(program.duration_months)}
          </span>
        </div>

        {/* Action Button - Navigate to shortlist in account */}
        <div className="mt-auto pt-2">
          <Button 
            size="sm" 
            variant="default"
            className="w-full text-xs h-8"
            onClick={() => onDetails(program.program_id)}
          >
            {t('portal.shortlist.applyNow')}
          </Button>
        </div>
      </div>
    </div>
  );
}
