/**
 * ============= ProgramCard - Unified v7 =============
 * Clean, spacious card with clear information hierarchy.
 * No overlapping text. Responsive and readable at all sizes.
 */
import { 
  DollarSign, Clock, Globe, MapPin, Home, Calendar, Award, BookOpen, Building2, Users, Briefcase, Heart, Loader2, ExternalLink, GraduationCap, Brain
} from "lucide-react";
import { ProgramInsightSheet } from "./programs/ProgramInsightSheet";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useGuestAwareShortlist } from "@/hooks/useGuestShortlist";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocalizedField } from "@/hooks/useLocalizedField";
import { useCountryName } from "@/hooks/useCountryName";
import { useDeterministicLocalizer } from "@/hooks/useDeterministicLocalizer";
import { cn } from "@/lib/utils";
import { resolveCountrySlugByName } from "@/lib/country/resolveCountrySlugByName";

export type ProgramCardData = {
  program_id: string;
  program_name: string;
  program_name_ar?: string | null;
  program_name_en?: string | null;
  university_id?: string;
  university_name: string;
  university_name_ar?: string | null;
  university_name_en?: string | null;
  city?: string | null;
  logo_url?: string | null;
  country_name: string;
  country_name_en?: string | null;
  country_name_ar?: string | null;
  country_slug?: string;
  currency_code?: string;
  degree_id?: string | null;
  degree_name?: string | null;
  degree_name_ar?: string | null;
  degree_name_en?: string | null;
  fees_yearly?: number | null;
  duration_months?: number | null;
  language?: string | null;
  languages?: string[] | null;
  instruction_languages?: string[] | null;
  study_mode?: string | null;
  intake_months?: (number | string)[] | null;
  next_intake_date?: string | null;
  has_dorm?: boolean | null;
  dorm_price_monthly_usd?: number | null;
  dorm_currency?: string | null;
  monthly_living_usd?: number | null;
  scholarship_available?: boolean | null;
  scholarship_type?: string | null;
  scholarship_percent_coverage?: number | null;
  scholarship_amount_usd?: number | null;
  scholarship_monthly_stipend_usd?: number | null;
  scholarship_covers_housing?: boolean | null;
  scholarship_covers_insurance?: boolean | null;
  ielts_required?: number | null;
  delivery_mode?: string | null;
  employment_rate?: number | null;
  enrolled_students?: number | null;
  required_documents?: string[] | null;
  entrance_exam_required?: boolean | null;
  has_scholarship?: boolean | null;
  discipline_name_ar?: string | null;
  discipline_name_en?: string | null;
  seats_status?: string | null;
  seats_available?: number | null;
  application_deadline?: string | null;
};

export function ProgramCard({ p, compact }: { p: ProgramCardData; compact?: boolean }) {
  const navigate = useNavigate();
  const { getField, getFieldMeta, hasLegacyNativeField, isResolverDisplaySource, language } = useLocalizedField();
  const uiLocale = language || 'en';
  const { t } = useLanguage();
  const { getCountryName } = useCountryName();
  const { localize } = useDeterministicLocalizer();
  const { add, remove, isInShortlist, isAdding, isRemoving } = useGuestAwareShortlist();
  const [isBusy, setIsBusy] = useState(false);
  const { formatPrice } = useCurrency();
  
  const isFavorite = isInShortlist(p.program_id);
  const busy = isBusy || isAdding || isRemoving;

  // Localized names
  const programMeta = getFieldMeta(p as any, 'program_name');
  const baseProgramName = programMeta.value;
  let displayProgramName = baseProgramName;
  const isResolverResolvedProgramName = isResolverDisplaySource(p as any, 'program_name');
  if (language === 'ar' && baseProgramName && !isResolverResolvedProgramName && !hasLegacyNativeField(p as any, 'program_name')) {
    const result = localize(baseProgramName);
    if (result.level === 'HIGH' && result.localized) {
      displayProgramName = result.localized;
    }
  }

  const displayUniversityName = getField(p as any, 'university_name');
  const months = p.duration_months ?? undefined;
  const years = months ? Math.round((months / 12) * 10) / 10 : undefined;
  
  const disciplineItem = { discipline_name: null, discipline_name_ar: p.discipline_name_ar, discipline_name_en: p.discipline_name_en };
  const disciplineDisplay = getField(disciplineItem as any, 'discipline_name');

  const countryLocaleFallback = getField(p as any, 'country_name') || p.country_name;
  const resolvedCountrySlug = p.country_slug || resolveCountrySlugByName(countryLocaleFallback || p.country_name);
  const countryDisplay = resolvedCountrySlug
    ? getCountryName(resolvedCountrySlug, countryLocaleFallback || p.country_name)
    : countryLocaleFallback || p.country_name;
  
  const money = (v?: number | null, c?: string | null) => {
    if (v == null) return null;
    if (v === 0) return t("fees.free");
    return formatPrice(v, c);
  };

  const languageDisplay = p.instruction_languages && p.instruction_languages.length > 0
    ? p.instruction_languages.join(' • ')
    : p.languages && p.languages.length > 0 
      ? p.languages.join(' • ')
      : p.language || null;
  
  const getStudyModeText = (mode: string) => {
    switch (mode) {
      case 'on_campus': return t("studyMode.onCampus");
      case 'online': return t("studyMode.online");
      case 'hybrid': return t("studyMode.hybrid");
      default: return mode;
    }
  };
  
  const getScholarshipText = () => {
    let text = '';
    switch (p.scholarship_type) {
      case 'full': text = t("scholarship.full"); break;
      case 'partial':
        if (p.scholarship_percent_coverage) text = `${t("scholarship.partial")} ${p.scholarship_percent_coverage}%`;
        else if (p.scholarship_amount_usd) text = `${t("scholarship.partial")} $${p.scholarship_amount_usd.toLocaleString(uiLocale)}`;
        else text = t("scholarship.partial");
        break;
      case 'tuition_waiver': text = t("scholarship.tuitionWaiver"); break;
      case 'stipend':
        text = p.scholarship_monthly_stipend_usd 
          ? `${t("scholarship.stipend")} $${p.scholarship_monthly_stipend_usd}`
          : t("scholarship.stipend");
        break;
      default: text = t("scholarship.available");
    }
    const extras = [];
    if (p.scholarship_covers_housing) extras.push(t("badge.housing"));
    if (p.scholarship_covers_insurance) extras.push(t("badge.insurance"));
    if (extras.length > 0) text += ` + ${extras.join(' + ')}`;
    return text;
  };
  
  const getMonthName = (monthNum: number | string) => t(`month.${Number(monthNum)}`);
  const monthJoiner = uiLocale.startsWith('ar') ? '، ' : ', ';

  const currCode = p.currency_code;
  const feesText = p.fees_yearly != null ? money(p.fees_yearly, currCode) : null;
  const durationText = years ? `${years} ${t("duration.year")}` : null;
  const dormCurr = p.dorm_currency || 'USD';
  const dormAmount = p.dorm_price_monthly_usd;
  const scholarshipAvailable = p.scholarship_available || p.has_scholarship;

  const intakeDisplay = p.next_intake_date 
    ? new Date(p.next_intake_date).toLocaleDateString(uiLocale, { month: 'long', year: 'numeric' })
    : p.intake_months && p.intake_months.length > 0 
      ? p.intake_months.map(m => getMonthName(m)).join(monthJoiner)
      : null;

  const degreeItem = { degree_name: p.degree_name, degree_name_ar: p.degree_name_ar, degree_name_en: p.degree_name_en };
  const degreeDisplay = getField(degreeItem, 'degree_name') || p.degree_name;

  const handleHeartClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setIsBusy(true);
    try {
      if (isFavorite) await remove(p.program_id);
      else await add(p.program_id);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/program/${p.program_id}`);
  };

  // Collect info items for the grid
  const infoItems: { icon: React.ReactNode; label: string; highlight?: boolean }[] = [];

  if (languageDisplay) {
    infoItems.push({ icon: <Globe className="w-3.5 h-3.5" />, label: languageDisplay });
  }
  if (p.study_mode || p.delivery_mode) {
    infoItems.push({ icon: <Building2 className="w-3.5 h-3.5" />, label: getStudyModeText(p.study_mode || p.delivery_mode || '') });
  }
  if (p.ielts_required) {
    infoItems.push({ icon: <BookOpen className="w-3.5 h-3.5" />, label: `IELTS: ${p.ielts_required}` });
  }
  if (p.has_dorm) {
    infoItems.push({ icon: <Home className="w-3.5 h-3.5" />, label: dormAmount ? `${money(dormAmount, dormCurr)}${t("fees.perMonth")}` : t("housing.available") });
  }
  if (p.employment_rate) {
    infoItems.push({ icon: <Briefcase className="w-3.5 h-3.5" />, label: `${p.employment_rate}%` });
  }
  if (p.enrolled_students) {
    infoItems.push({ icon: <Users className="w-3.5 h-3.5" />, label: p.enrolled_students.toLocaleString(uiLocale) });
  }

  return (
    <div className="group relative bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/40 transition-all duration-300 hover:shadow-xl flex flex-col">
      {/* Header: Heart + ORX + Degree badge */}
      <div className="flex items-center justify-between p-4 pb-0">
        <div className="flex items-center gap-1.5">
        <button
          onClick={handleHeartClick}
          disabled={busy}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0",
            "bg-muted/60 hover:bg-muted hover:scale-110",
            "disabled:opacity-50",
          )}
          aria-label={isFavorite ? t("action.removeFromFavorites") : t("action.addToFavorites")}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Heart className={cn("w-4 h-4 transition-colors", isFavorite ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive")} />
          )}
        </button>
        </div>

        {degreeDisplay && (
          <Badge className="text-[11px] font-bold bg-foreground text-background rounded-full px-3 py-1">
            <GraduationCap className="w-3.5 h-3.5 ltr:mr-1 rtl:ml-1" />
            {degreeDisplay}
          </Badge>
        )}
      </div>

      {/* Program name + University logo */}
      <div className={cn("px-4 pt-3 pb-2 flex items-start", !compact && "gap-3")}>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
            {displayProgramName}
          </h3>
          {!compact && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{displayUniversityName}</span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            {[p.city, countryDisplay].filter(Boolean).join(' • ')}
          </p>
        </div>
        {!compact && (
          <Avatar className="w-12 h-12 border-2 border-border shrink-0 rounded-lg">
            <AvatarImage src={p.logo_url || undefined} alt={displayUniversityName || "University"} className="object-contain" />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm rounded-lg">
              {String(displayUniversityName || "U").trim().charAt(0)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Fees highlight */}
      {feesText && (
        <div className="mx-4 mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary font-bold text-sm rounded-lg px-3 py-1.5">
            <DollarSign className="w-4 h-4" />
            {feesText}
          </span>
          <span className="text-[10px] text-muted-foreground">/{t("fees.perYear")}</span>
        </div>
      )}

      {/* Info chips row */}
      {infoItems.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-x-4 gap-y-2">
          {infoItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="text-primary">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Intake */}
      {intakeDisplay && (
        <div className="px-4 pb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{intakeDisplay}</span>
        </div>
      )}

      {/* Tags */}
      {(scholarshipAvailable || (p.seats_status && p.seats_status !== 'open') || p.application_deadline || p.entrance_exam_required || disciplineDisplay) && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {disciplineDisplay && (
            <Badge variant="outline" className="text-[10px] bg-accent/20 border-accent/30">
              {disciplineDisplay}
            </Badge>
          )}
          {scholarshipAvailable && (
            <Badge className="text-[10px] bg-success/10 text-success border-success/20 font-medium">
              <Award className="w-3 h-3 ltr:mr-0.5 rtl:ml-0.5" />
              {p.scholarship_type ? getScholarshipText() : (p.has_scholarship && p.scholarship_percent_coverage ? `${t("scholarship.partial")} ${p.scholarship_percent_coverage}%` : t("badge.scholarship"))}
            </Badge>
          )}
          {durationText && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3 ltr:mr-0.5 rtl:ml-0.5" />
              {durationText}
            </Badge>
          )}
          {p.seats_status && p.seats_status !== 'open' && (
            <Badge variant="outline" className={cn(
              "text-[10px]",
              p.seats_status === 'limited' && "text-amber-700 border-amber-300 bg-amber-50",
              p.seats_status === 'full' && "text-destructive border-destructive/30 bg-destructive/5",
              p.seats_status === 'closed' && "text-muted-foreground border-border bg-muted/50",
            )}>
              {p.seats_status === 'limited' ? t("badge.seatsLimited") : p.seats_status === 'full' ? t("badge.seatsFull") : t("badge.seatsClosed")}
              {p.seats_available != null && p.seats_status === 'limited' && ` (${p.seats_available})`}
            </Badge>
          )}
          {p.application_deadline && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3 ltr:mr-0.5 rtl:ml-0.5" />
              {new Date(p.application_deadline).toLocaleDateString(uiLocale, { month: 'short', day: 'numeric' })}
            </Badge>
          )}
          {p.entrance_exam_required && (
            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
              {t("badge.entranceExam")}
            </Badge>
          )}
        </div>
      )}

      {/* ORX Intelligence trigger */}
      <div className="px-4 pb-3 mt-auto flex justify-end">
        <ProgramInsightSheet
          programId={p.program_id}
          programName={displayProgramName || ''}
          universityId={p.university_id || null}
        >
          <button
            className="w-7 h-7 rounded-full bg-primary/8 hover:bg-primary/15 flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)] group/orx"
            title={t("insight.viewInsight")}
          >
            <Brain className="w-3.5 h-3.5 text-primary/70 group-hover/orx:text-primary transition-colors" />
          </button>
        </ProgramInsightSheet>
      </div>
    </div>
  );
}
