import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { LucideIcon } from "lucide-react";
import { AnimatedServiceIcon } from "./AnimatedServiceIcon";
import { motion, useInView } from "framer-motion";

interface DSIconGridItemProps {
  emoji?: string;
  icon?: LucideIcon;
  iconKey?: string;
  iconColor?: string;
  title: string;
  description?: string;
  comingSoon?: boolean;
  className?: string;
  onClick?: () => void;
}

const getIconColorClasses = (iconKey: string = "default") => {
  const normalizedKey = iconKey.toLowerCase();
  
  const colorMap: Record<string, { bg: string; border: string }> = {
    plane: { bg: "bg-sky-500/10 dark:bg-sky-400/15", border: "hover:border-sky-500/40" },
    airport: { bg: "bg-sky-500/10 dark:bg-sky-400/15", border: "hover:border-sky-500/40" },
    translation: { bg: "bg-indigo-500/10 dark:bg-indigo-400/15", border: "hover:border-indigo-500/40" },
    translation_russia: { bg: "bg-indigo-500/10 dark:bg-indigo-400/15", border: "hover:border-indigo-500/40" },
    home: { bg: "bg-amber-500/10 dark:bg-amber-400/15", border: "hover:border-amber-500/40" },
    accommodation: { bg: "bg-amber-500/10 dark:bg-amber-400/15", border: "hover:border-amber-500/40" },
    bank: { bg: "bg-emerald-500/10 dark:bg-emerald-400/15", border: "hover:border-emerald-500/40" },
    banknote: { bg: "bg-emerald-500/10 dark:bg-emerald-400/15", border: "hover:border-emerald-500/40" },
    health: { bg: "bg-rose-500/10 dark:bg-rose-400/15", border: "hover:border-rose-500/40" },
    medical: { bg: "bg-rose-500/10 dark:bg-rose-400/15", border: "hover:border-rose-500/40" },
    graduation: { bg: "bg-violet-500/10 dark:bg-violet-400/15", border: "hover:border-violet-500/40" },
    course: { bg: "bg-violet-500/10 dark:bg-violet-400/15", border: "hover:border-violet-500/40" },
    sim: { bg: "bg-cyan-500/10 dark:bg-cyan-400/15", border: "hover:border-cyan-500/40" },
    phone: { bg: "bg-cyan-500/10 dark:bg-cyan-400/15", border: "hover:border-cyan-500/40" },
    visa: { bg: "bg-purple-500/10 dark:bg-purple-400/15", border: "hover:border-purple-500/40" },
    passport: { bg: "bg-purple-500/10 dark:bg-purple-400/15", border: "hover:border-purple-500/40" },
    bitcoin: { bg: "bg-orange-500/10 dark:bg-orange-400/15", border: "hover:border-orange-500/40" },
    crypto: { bg: "bg-orange-500/10 dark:bg-orange-400/15", border: "hover:border-orange-500/40" },
    "csw-coin": { bg: "bg-orange-500/10 dark:bg-orange-400/15", border: "hover:border-orange-500/40" },
  };
  
  return colorMap[normalizedKey] || {
    bg: "bg-primary/10 dark:bg-primary/15",
    border: "hover:border-primary/40"
  };
};

export function DSIconGridItem({ 
  emoji, 
  icon: Icon, 
  iconKey = "default",
  iconColor = "text-primary", 
  title, 
  description, 
  comingSoon, 
  className, 
  onClick 
}: DSIconGridItemProps) {
  const { t, language } = useLanguage();
  const isRTL = ["ar", "he", "fa", "ur"].includes(language);
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  
  const colorClasses = getIconColorClasses(iconKey);

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      dir={isRTL ? "rtl" : "ltr"}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl p-4 transition-all duration-200",
        "bg-card",
        "border border-border/50",
        colorClasses.border,
        "shadow-sm hover:shadow-md",
        "hover:-translate-y-1",
        isRTL ? "items-end text-right" : "items-start text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        comingSoon && "opacity-70 cursor-not-allowed",
        "w-full",
        className
      )}
    >
      {/* Icon */}
      <div className={cn(
        "flex items-center justify-center w-12 h-12 rounded-xl",
        colorClasses.bg,
        "transition-transform duration-200",
        "group-hover:scale-105"
      )}>
        {Icon ? (
          <AnimatedServiceIcon
            icon={Icon}
            iconKey={iconKey}
            iconColor={iconColor}
            isHovered={isHovered}
            isArabic={isRTL}
            triggerOnScroll={true}
          />
        ) : (
          <span className="text-2xl">{emoji || "📚"}</span>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 space-y-1">
        <h3 className="text-base font-semibold text-foreground leading-snug group-hover:text-primary transition-colors duration-200">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {description}
          </p>
        )}
      </div>
      
      {/* Coming Soon Badge */}
      {comingSoon && (
        <div className="absolute top-2 end-2 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
          {t("common.comingSoon")}
        </div>
      )}
    </motion.button>
  );
}
