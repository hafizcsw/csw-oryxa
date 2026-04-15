import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, Trophy, Users, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountryName } from "@/hooks/useCountryName";
import { useLanguage } from "@/contexts/LanguageContext";

interface CountryStats {
  universitiesCount: number;
  programsCount: number;
  rankedUniversitiesCount: number;
  educationRankGlobal?: number | null;
  internationalStudents?: number | null;
}

interface CountryStatCardProps {
  slug: string;
  nameAr: string;
  nameEn?: string | null;
  imageUrl?: string | null;
  countryCode: string;
  stats: CountryStats;
  className?: string;
}

export function CountryStatCard({
  slug,
  nameAr,
  nameEn,
  imageUrl,
  countryCode,
  stats,
  className,
}: CountryStatCardProps) {
  const { getCountryName, currentLanguage } = useCountryName();
  const { t } = useLanguage();
  const isArabic = currentLanguage === "ar";
  
  // Use centralized translation system with fallback to provided names
  const displayName = getCountryName(slug, isArabic ? nameAr : (nameEn || nameAr));
  
  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const statItems = [
    {
      icon: GraduationCap,
      value: stats.universitiesCount,
      label: t("country.universities"),
      show: true,
    },
    {
      icon: BookOpen,
      value: stats.programsCount,
      label: t("country.programs"),
      show: true,
    },
    {
      icon: Trophy,
      value: stats.rankedUniversitiesCount,
      label: t("university.ranked"),
      show: stats.rankedUniversitiesCount > 0,
    },
    {
      icon: TrendingUp,
      value: stats.educationRankGlobal,
      label: t("university.ranking"),
      show: stats.educationRankGlobal != null,
      prefix: "#",
    },
  ];

  return (
    <Link
      to={`/country/${slug}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl bg-card border border-border",
        "shadow-md hover:shadow-xl transition-all duration-300",
        "hover:-translate-y-1",
        className
      )}
    >
      {/* Image Section */}
      <div className="relative h-48 sm:h-56 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
            <span className="text-6xl opacity-50">🌍</span>
          </div>
        )}
        
        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Country Flag & Name */}
        <div className="absolute bottom-0 inset-x-0 p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl drop-shadow-lg" role="img" aria-label={`${countryCode} flag`}>
              {getFlagEmoji(countryCode)}
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
              {displayName}
            </h3>
          </div>
        </div>
        
        {/* International Students Badge (if available) */}
        {stats.internationalStudents && stats.internationalStudents > 0 && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-black/70 backdrop-blur-sm text-xs font-medium shadow-lg">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span className="text-foreground">{formatNumber(stats.internationalStudents)}</span>
            <span className="text-muted-foreground">{t("country.internationalStudents")}</span>
          </div>
        )}
      </div>
      
      {/* Stats Bar */}
      <div className="p-3 sm:p-4 bg-card">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {statItems.filter(s => s.show).slice(0, 4).map((stat, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <stat.icon className="w-4 h-4 text-primary mb-1" />
              <span className="text-sm sm:text-base font-bold text-foreground">
                {stat.prefix || ""}{stat.value}
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground text-center">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

// Helper function to get flag emoji from country code
function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
