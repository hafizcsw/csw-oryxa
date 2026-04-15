import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { MessageCircle, Calendar, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeacherCardProps {
  teacherName?: string | null;
  teacherAvatar?: string | null;
  rating?: number | null;
  nextSessionDate?: string | null;
  className?: string;
}

export function TeacherCard({
  teacherName,
  teacherAvatar,
  rating,
  nextSessionDate,
  className,
}: TeacherCardProps) {
  const { t } = useLanguage();

  if (!teacherName) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className={cn(
        "bg-card rounded-xl border border-border p-4 flex items-center gap-4",
        className
      )}
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {teacherAvatar ? (
          <img
            src={teacherAvatar}
            alt={teacherName}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-6 h-6 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">
          {teacherName}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("languages.dashboard.teacher.role")}
        </p>
        {rating && (
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="text-xs font-medium text-foreground">{rating}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          className="w-9 h-9 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
          title={t("languages.dashboard.teacher.message")}
        >
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
        </button>
        {nextSessionDate && (
          <button
            className="w-9 h-9 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
            title={t("languages.dashboard.teacher.nextSession")}
          >
            <Calendar className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
