import { useLanguage } from "@/contexts/LanguageContext";
import { Flame } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StreakTrackerProps {
  daysActive: number;
  className?: string;
}

export function StreakTracker({ daysActive, className }: StreakTrackerProps) {
  const { t } = useLanguage();
  const streakDays = Math.min(daysActive, 7);

  const dayKeys = [
    "languages.dashboard.streak.mon",
    "languages.dashboard.streak.tue",
    "languages.dashboard.streak.wed",
    "languages.dashboard.streak.thu",
    "languages.dashboard.streak.fri",
    "languages.dashboard.streak.sat",
    "languages.dashboard.streak.sun",
  ];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {dayKeys.map((key, i) => {
        const isActive = i < streakDays;
        return (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                isActive
                  ? "bg-gradient-to-br from-orange-400 to-amber-500 shadow-md shadow-orange-500/20"
                  : "bg-muted"
              )}
            >
              <Flame
                className={cn(
                  "w-4 h-4",
                  isActive ? "text-primary-foreground" : "text-muted-foreground/40"
                )}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">
              {t(key)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
