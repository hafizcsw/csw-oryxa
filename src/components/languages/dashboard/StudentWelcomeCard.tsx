import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Award, TrendingUp, Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardPayload } from "@/types/russianExecutionPack";

interface StudentWelcomeCardProps {
  userName?: string;
  daysActive: number;
  overallProgress: number;
  cefrBand?: string | null;
  readinessBand?: string | null;
  dashboardData?: DashboardPayload | null;
}

export function StudentWelcomeCard({
  userName,
  daysActive,
  overallProgress,
  cefrBand,
  readinessBand,
  dashboardData,
}: StudentWelcomeCardProps) {
  const { t } = useLanguage();
  const displayBand = cefrBand || readinessBand || null;
  const initials = userName
    ? userName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "🇷🇺";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/12 via-primary/4 to-card p-6 md:p-7"
    >
      {/* Decorative glows */}
      <div className="absolute -top-24 -end-24 w-48 h-48 rounded-full bg-primary/8 blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-16 -start-16 w-32 h-32 rounded-full bg-primary/6 blur-[60px] pointer-events-none" />

      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        {/* Left: avatar + greeting + badges */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-xl font-bold text-primary-foreground shadow-lg shadow-primary/25 shrink-0 ring-2 ring-primary/20 ring-offset-2 ring-offset-card">
            {initials}
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-foreground leading-tight">
              {userName
                ? t("languages.dashboard.welcomeUser", { name: userName })
                : t("languages.dashboard.welcomeBack")}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {displayBand && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-primary/15 text-primary px-2.5 py-1 rounded-full">
                  <Award className="w-3 h-3" />
                  {displayBand}
                </span>
              )}
              {daysActive > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gradient-to-r from-orange-500/15 to-amber-500/15 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full">
                  <Flame className="w-3 h-3" />
                  {daysActive} {t("languages.dashboard.streak.days")}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" />
                {overallProgress}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: quick stat */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm">
            <Zap className="w-4 h-4 text-primary" />
            <div className="text-start">
              <p className="text-lg font-bold text-foreground leading-none">{overallProgress}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t("languages.dashboard.overallProgress")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar with glow */}
      <div className="mt-5 relative">
        <div className="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-primary via-primary/90 to-primary/70 rounded-full relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 rounded-full" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
