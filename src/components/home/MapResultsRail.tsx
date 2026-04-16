import { memo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Globe, MapPin, Building2, GraduationCap, DollarSign,
  ChevronRight, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CitySummary } from "@/hooks/useMapData";

type DrillLevel = "world" | "country" | "city";

interface CountryInfo {
  universities_count: number;
  programs_count: number;
  fee_min?: number | null;
  fee_max?: number | null;
  country_name_ar?: string;
  country_name_en?: string;
}

interface UniversityRow {
  university_id: string;
  university_name_ar?: string | null;
  university_name_en?: string | null;
  university_logo?: string | null;
  programs_count?: number | null;
  fee_min?: number | null;
  fee_max?: number | null;
  city?: string | null;
}

interface MapResultsRailProps {
  drillLevel: DrillLevel;
  /** World level: country stats keyed by country code */
  countryStats: Record<string, CountryInfo> | null | undefined;
  /** Country level: visible cities */
  visibleCities: CitySummary[];
  /** City level: universities in selected city */
  cityUniversities: UniversityRow[];
  /** Currently selected country */
  selectedCountryCode: string | null;
  /** Currently selected city */
  selectedCity: string | null;
  /** Country metadata for images */
  countryMeta?: Record<string, { slug: string; name_ar: string; name_en: string | null; image_url: string | null }> | null;
  /** Region filter codes */
  filteredCodes: Set<string> | null;
  /** Callbacks for bidirectional sync */
  onCountryClick: (code: string) => void;
  onCityClick: (city: string) => void;
  /** Localized country name */
  countryDisplayName: (code: string, stats?: Record<string, unknown> | null) => string;
}

export const MapResultsRail = memo(function MapResultsRail({
  drillLevel,
  countryStats,
  visibleCities,
  cityUniversities,
  selectedCountryCode,
  selectedCity,
  countryMeta,
  filteredCodes,
  onCountryClick,
  onCityClick,
  countryDisplayName,
}: MapResultsRailProps) {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const getLocalizedValue = useCallback((record: Record<string, unknown>, keyPrefix: string) => {
    const byActive = record[`${keyPrefix}_${language}`];
    if (typeof byActive === "string" && byActive.trim()) return byActive;
    const en = record[`${keyPrefix}_en`];
    if (typeof en === "string" && en.trim()) return en;
    const ar = record[`${keyPrefix}_ar`];
    if (typeof ar === "string" && ar.trim()) return ar;
    return "";
  }, [language]);

  // Reset scroll when drill level or selection changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [drillLevel, selectedCountryCode, selectedCity]);

  const scroll = useCallback((dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 280 : -280, behavior: "smooth" });
  }, []);

  // ── WORLD: country cards ──
  if (drillLevel === "world") {
    const entries = Object.entries(countryStats || {})
      .filter(([code, v]) => {
        if (v.universities_count === 0) return false;
        if (filteredCodes && !filteredCodes.has(code)) return false;
        return true;
      })
      .sort(([, a], [, b]) => b.universities_count - a.universities_count)
      .slice(0, 30);

    if (entries.length === 0) return null;

    return (
      <RailWrapper scrollRef={scrollRef} onScroll={scroll} label={t("home.worldMap.section.topCountries")} count={entries.length} icon={<Globe className="h-3.5 w-3.5" />}>
        {entries.map(([code, info]) => {
          const flagUrl = `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
          return (
            <button
              key={code}
              onClick={() => onCountryClick(code)}
              className={cn(
                "shrink-0 w-[200px] rounded-xl border border-border bg-card hover:bg-accent/10 transition-all p-3 text-start group snap-start",
                selectedCountryCode === code && "ring-2 ring-primary border-primary"
              )}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <img
                  src={flagUrl}
                  alt=""
                  className="w-8 h-6 rounded object-cover border border-border/50"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {countryDisplayName(code, info as unknown as Record<string, unknown>)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-primary/60" />
                  {info.universities_count}
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-3 w-3 text-primary/60" />
                  {info.programs_count.toLocaleString()}
                </span>
              </div>
            </button>
          );
        })}
      </RailWrapper>
    );
  }

  // ── COUNTRY: city cards ──
  if (drillLevel === "country") {
    const cities = visibleCities.filter(c => c.city !== "__unknown__");
    if (cities.length === 0) return null;

    return (
      <RailWrapper scrollRef={scrollRef} onScroll={scroll} label={t("home.worldMap.labels.cities")} count={cities.length} icon={<MapPin className="h-3.5 w-3.5" />}>
        {cities.sort((a, b) => b.universities_count - a.universities_count).map((city) => (
          <button
            key={city.city}
            onClick={() => onCityClick(city.city)}
            className={cn(
              "shrink-0 w-[200px] rounded-xl border border-border bg-card hover:bg-accent/10 transition-all p-3 text-start group snap-start",
              selectedCity === city.city && "ring-2 ring-primary border-primary"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {city.city}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3 text-primary/60" />
                {city.universities_count}
              </span>
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3 w-3 text-primary/60" />
                {city.programs_count}
              </span>
              {city.fee_min != null && (
                <span className="flex items-center gap-1 text-muted-foreground/60">
                  <DollarSign className="h-3 w-3" />
                  {city.fee_min.toLocaleString()}
                </span>
              )}
            </div>
          </button>
        ))}
      </RailWrapper>
    );
  }

  // ── CITY: university cards ──
  if (drillLevel === "city") {
    if (cityUniversities.length === 0) return null;

    return (
      <RailWrapper scrollRef={scrollRef} onScroll={scroll} label={t("home.worldMap.labels.universities")} count={cityUniversities.length} icon={<Building2 className="h-3.5 w-3.5" />}>
        {cityUniversities.map((uni) => (
          <button
            key={uni.university_id}
            onClick={() => navigate(`/university/${uni.university_id}`)}
            className="shrink-0 w-[220px] rounded-xl border border-border bg-card hover:bg-accent/10 transition-all p-3 text-start group snap-start"
          >
            <div className="flex items-center gap-2.5 mb-2">
              {uni.university_logo ? (
                <img src={uni.university_logo} alt="" className="w-10 h-10 rounded-lg object-contain bg-background border border-border shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-muted-foreground/50" />
                </div>
              )}
              <span className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {getLocalizedValue(uni as unknown as Record<string, unknown>, "university_name")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3 w-3 text-primary/60" />
                {uni.programs_count || 0}
              </span>
              {uni.fee_min != null && (
                <span className="flex items-center gap-1 text-muted-foreground/60">
                  <DollarSign className="h-3 w-3" />
                  ${uni.fee_min.toLocaleString()}
                </span>
              )}
            </div>
          </button>
        ))}
      </RailWrapper>
    );
  }

  return null;
});

/* ── Rail wrapper with scroll arrows ── */
function RailWrapper({
  children,
  scrollRef,
  onScroll,
  label,
  count,
  icon,
}: {
  children: React.ReactNode;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: (dir: "left" | "right") => void;
  label: string;
  count: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative border-t border-border bg-card/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {icon}
          {label}
          <span className="text-primary font-black">({count})</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onScroll("left")}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onScroll("right")}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Scrollable rail */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-3 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
    </div>
  );
}
