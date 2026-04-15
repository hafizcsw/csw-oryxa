import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Globe, DollarSign, GraduationCap, Building2, Home,
  Flag, Award, Calendar, Percent, Users, ChevronLeft, Clock,
  Sparkles
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCountryName } from "@/hooks/useCountryName";
import { useLocalizedField } from "@/hooks/useLocalizedField";
import { HeartButton } from "@/components/shortlist/HeartButton";
import { cn } from "@/lib/utils";

export interface University {
  id: string;
  name: string;
  city?: string;
  logo_url?: string;
  image_url?: string;
  annual_fees?: number;
  monthly_living?: number;
  description?: string;
  country_id: string;
  country_slug: string;
  country_name: string;
  currency_code?: string;
  min_duration_months?: number | null;
  min_ielts_required?: number | null;
  next_intake_date?: string | null;
  world_rank?: number | null;
  ranking_system?: string | null;
  acceptance_rate?: number | null;
  enrolled_students?: number | null;
  degree_ids?: string[] | null;
  qs_world_rank?: number | null;
  qs_national_rank?: number | null;
  uniranks_national_rank?: number | null;
  tuition_usd_min?: number | null;
  tuition_usd_max?: number | null;
  program_count?: number | null;
  has_dorm?: boolean | null;
  dorm_price_monthly_local?: number | null;
  university_type?: string | null;
}

interface UniversityCardProps {
  university: University;
  onViewDetails?: (universityId: string) => void;
  onApplyNow?: (universityId: string) => void;
}

export function UniversityCard({ university }: UniversityCardProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { getCountryName } = useCountryName();
  const { getField } = useLocalizedField();
  const isRtl = language === "ar";
  const uiLocale = language || "en";
  const localePrefix = language === "ar" ? "ar" : "en";
  const localizePath = (path: string) => `/${localePrefix}${path.startsWith('/') ? path : `/${path}`}`;

  const uniName = getField(university, 'name') || university.name;
  const translatedCountryName = getCountryName(university.country_slug, university.country_name);

  const formatMoney = (amount?: number | null, code?: string) => {
    if (amount == null) return null;
    if (code) {
      try {
        return new Intl.NumberFormat(uiLocale, {
          style: "currency",
          currency: code,
          maximumFractionDigits: 0,
        }).format(amount);
      } catch { /* fall through */ }
    }
    return amount.toLocaleString(uiLocale);
  };

  const nationalRank = university.qs_national_rank || university.uniranks_national_rank;
  const globalRank = university.qs_world_rank || university.world_rank;
  const programCount = university.program_count || university.degree_ids?.length || 0;
  const isPublic = university.university_type === "public";
  const isPrivate = university.university_type === "private";

  // Tuition display
  const tuitionDisplay = (() => {
    if (university.tuition_usd_min || university.tuition_usd_max) {
      const min = formatMoney(university.tuition_usd_min, "USD");
      const max = formatMoney(university.tuition_usd_max, "USD");
      if (min && max && min !== max) return `${min} – ${max}`;
      return min || max;
    }
    if (university.annual_fees) return formatMoney(university.annual_fees, university.currency_code);
    return null;
  })();

  // Secondary stats
  const secondaryStats: { icon: React.ReactNode; label: string; value: string; color: string }[] = [];

  if (university.min_ielts_required) {
    secondaryStats.push({
      icon: <Award className="w-3 h-3" />,
      label: "IELTS",
      value: `${university.min_ielts_required}+`,
      color: "text-purple-600 dark:text-purple-400",
    });
  }
  if (university.acceptance_rate) {
    secondaryStats.push({
      icon: <Percent className="w-3 h-3" />,
      label: t("university.acceptanceRate"),
      value: `${university.acceptance_rate}%`,
      color: "text-rose-600 dark:text-rose-400",
    });
  }
  if (university.enrolled_students) {
    secondaryStats.push({
      icon: <Users className="w-3 h-3" />,
      label: t("university.students"),
      value: university.enrolled_students.toLocaleString(uiLocale),
      color: "text-sky-600 dark:text-sky-400",
    });
  }
  if (university.next_intake_date) {
    try {
      const d = new Date(university.next_intake_date);
      secondaryStats.push({
        icon: <Calendar className="w-3 h-3" />,
        label: t("university.intake"),
        value: d.toLocaleDateString(uiLocale, { month: "short", year: "numeric" }),
        color: "text-teal-600 dark:text-teal-400",
      });
    } catch {}
  }
  if (university.min_duration_months) {
    secondaryStats.push({
      icon: <Clock className="w-3 h-3" />,
      label: t("university.duration"),
      value: `${university.min_duration_months} ${t("university.durationMonths")}`,
      color: "text-indigo-600 dark:text-indigo-400",
    });
  }
  if (university.dorm_price_monthly_local) {
    secondaryStats.push({
      icon: <Home className="w-3 h-3" />,
      label: t("university.dormCost"),
      value: `${formatMoney(university.dorm_price_monthly_local, university.currency_code)}/${t("university.perMonth")}`,
      color: "text-emerald-600 dark:text-emerald-400",
    });
  } else if (university.monthly_living) {
    secondaryStats.push({
      icon: <Home className="w-3 h-3" />,
      label: t("university.livingCost"),
      value: `${formatMoney(university.monthly_living, university.currency_code)}/${t("university.perMonth")}`,
      color: "text-orange-600 dark:text-orange-400",
    });
  }

  const logoValid = university.logo_url && !university.logo_url.includes("example.com") && !university.logo_url.includes("default_color");

  // Accent color based on type
  const accentClass = isPublic
    ? "bg-blue-500"
    : isPrivate
    ? "bg-purple-500"
    : "bg-primary";

  return (
    <div data-fly-card
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-primary/30 hover:-translate-y-0.5 flex flex-col h-full"
      onClick={() => navigate(localizePath(`/university/${university.id}`))}
    >
      {/* Accent stripe */}
      <div className={cn("h-1 w-full", accentClass)} />

      {/* ── Header: Logo + Name + ORX Badge ── */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Logo */}
          <div data-uni-logo={university.id} className="flex-shrink-0 w-16 h-16 rounded-2xl border-2 border-border/60 bg-background flex items-center justify-center overflow-hidden shadow-sm ring-2 ring-background">
            {logoValid ? (
              <img
                src={university.logo_url!}
                alt=""
                className="w-full h-full object-contain p-1.5"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <span className={cn("text-2xl font-black text-primary", logoValid && "hidden")}>
              {(university.name || "U").charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Name + Location + Type */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {uniName}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
              <span className="text-xs font-medium truncate">
                {university.city ? `${university.city}, ${translatedCountryName}` : translatedCountryName}
              </span>
            </div>
            {/* Type badge inline */}
            <div className="flex items-center gap-1.5 mt-1.5">
              {university.university_type && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md",
                  isPublic ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                )}>
                  <Building2 className="w-2.5 h-2.5" />
                  {isPublic ? t("university.public") : isPrivate ? t("university.private") : university.university_type}
                </span>
              )}
              {programCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                  <GraduationCap className="w-2.5 h-2.5" />
                  {programCount} {t("university.programsAvailable")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ORX RANK inline badge */}
        <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/8 to-amber-500/4 border border-amber-500/15">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-bold tracking-widest text-amber-500 uppercase">{t("orx.brandName")}</span>
          <span className="text-[10px] text-muted-foreground">{t("orx.evaluating.title")}</span>
        </div>
      </div>

      {/* ── Description ── */}
      {(university.description || (university as any).description_ar) && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
            {getField(university, 'description') || university.description}
          </p>
        </div>
      )}

      {/* ── Highlight Stats (Tuition + Ranks) ── */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-3 gap-2">
          {/* Tuition */}
          {tuitionDisplay && (
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-1" />
              <span className="text-sm font-black text-foreground leading-none">{tuitionDisplay}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">{t("university.feesYear")}{t("university.perYear")}</span>
            </div>
          )}

          {/* Global Rank */}
          {globalRank && (
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-blue-500/8 border border-blue-500/15">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 mb-1" />
              <span className="text-sm font-black text-foreground leading-none">#{globalRank.toLocaleString(uiLocale)}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">
                {university.qs_world_rank ? t("university.qsRank") : t("university.globalRanking")}
              </span>
            </div>
          )}

          {/* National Rank */}
          {nationalRank && (
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15">
              <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400 mb-1" />
              <span className="text-sm font-black text-foreground leading-none">#{nationalRank}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">{t("university.nationalRanking")}</span>
            </div>
          )}

          {/* If no rank data, show placeholders for balance */}
          {!tuitionDisplay && !globalRank && !nationalRank && (
            <div className="col-span-3 text-center py-2 text-xs text-muted-foreground/60">—</div>
          )}
        </div>
      </div>

      {/* ── Secondary Stats (compact pills) ── */}
      {secondaryStats.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {secondaryStats.slice(0, 5).map((stat, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 border border-border/30 text-[11px]"
              >
                <span className={cn("flex-shrink-0", stat.color)}>{stat.icon}</span>
                <span className="text-muted-foreground">{stat.label}:</span>
                <span className="font-semibold text-foreground">{stat.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Dorm Badge ── */}
      {university.has_dorm !== null && university.has_dorm !== undefined && !university.dorm_price_monthly_local && (
        <div className="px-4 pb-3">
          {university.has_dorm ? (
            <Badge variant="secondary" className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-2 py-0.5">
              <Home className="w-3 h-3 mr-0.5" />
              {t("university.dormAvailable")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] font-medium bg-muted/60 text-muted-foreground border-border/40 px-2 py-0.5">
              <Home className="w-3 h-3 mr-0.5" />
              {t("university.noDorm")}
            </Badge>
          )}
        </div>
      )}

      {/* ── Footer: Heart Favorites Button ── */}
      <div className="px-4 pb-4 mt-auto">
        <HeartButton
          universityId={university.id}
          type="university"
          variant="button"
          className="w-full justify-center py-2.5 rounded-xl text-xs font-semibold"
          flySourceSelector={`[data-uni-logo="${university.id}"]`}
        />
      </div>
    </div>
  );
}
