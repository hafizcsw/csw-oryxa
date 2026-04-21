import { motion, useReducedMotion } from "framer-motion";
import { Headset } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PanelHeroProps {
  name: string | null;
}

export function PanelHero({ name }: PanelHeroProps) {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const greeting = name
    ? t("portal.support.panel.greeting", { name })
    : t("portal.support.panel.greetingFallback");
  const subtitle = t("portal.support.panel.welcomeTo", { brand: "Oryxa" });

  return (
    <div className="flex items-start justify-between gap-3 px-1">
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight truncate">
          {greeting}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {subtitle}
        </p>
      </div>
      <motion.div
        animate={reduced ? undefined : { scale: [1, 1.04, 1] }}
        transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="shrink-0 h-14 w-14 rounded-full bg-gradient-to-br from-primary/30 via-primary/15 to-primary/5 flex items-center justify-center text-primary shadow-inner"
        aria-hidden="true"
      >
        <Headset className="h-6 w-6" strokeWidth={2.25} />
      </motion.div>
    </div>
  );
}
