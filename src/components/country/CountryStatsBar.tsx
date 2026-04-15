import { Building2, BookOpen, Trophy, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CountryStatsBarProps {
  universitiesCount: number;
  programsCount: number;
  globalRank?: number | null;
  internationalStudents?: number | null;
}

const StatItem = ({ 
  icon: Icon, 
  value, 
  label 
}: { 
  icon: React.ElementType; 
  value: string | number; 
  label: string;
}) => (
  <div className="group flex flex-col items-center gap-3 p-6 rounded-xl bg-background/50 border border-border/50 transition-all duration-300 hover:bg-primary/5 hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg cursor-default">
    <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
      <Icon className="w-6 h-6" />
    </div>
    <span className="text-3xl md:text-4xl font-bold text-foreground">{value}</span>
    <span className="text-sm text-muted-foreground font-medium">{label}</span>
  </div>
);

export function CountryStatsBar({ 
  universitiesCount, 
  programsCount, 
  globalRank, 
  internationalStudents 
}: CountryStatsBarProps) {
  const { t } = useLanguage();

  const formatNumber = (num: number | null | undefined): string => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M+`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K+`;
    return num.toLocaleString();
  };

  return (
    <section className="relative -mt-20 z-20 container mx-auto px-4">
      <div className="bg-card/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl p-6 md:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatItem 
            icon={Building2} 
            value={universitiesCount} 
            label={t("country.universities")} 
          />
          <StatItem 
            icon={BookOpen} 
            value={programsCount} 
            label={t("country.programs")} 
          />
          {globalRank && (
            <StatItem 
              icon={Trophy} 
              value={`#${globalRank}`} 
              label={t("country.globalRank")} 
            />
          )}
          {internationalStudents && (
            <StatItem 
              icon={Users} 
              value={formatNumber(internationalStudents)} 
              label={t("country.internationalStudents")} 
            />
          )}
        </div>
      </div>
    </section>
  );
}
