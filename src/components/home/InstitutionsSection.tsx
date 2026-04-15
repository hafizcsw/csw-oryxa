import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Users, BarChart3, ShieldCheck, ArrowRight, Globe, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function InstitutionsSection() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = ["ar", "he", "fa", "ur"].includes(language);

  const features = [
    { icon: Building2, titleKey: "home.institutions.features.manage.title", descKey: "home.institutions.features.manage.desc", color: "bg-blue-500/10 text-blue-500" },
    { icon: Users, titleKey: "home.institutions.features.students.title", descKey: "home.institutions.features.students.desc", color: "bg-emerald-500/10 text-emerald-500" },
    { icon: BarChart3, titleKey: "home.institutions.features.analytics.title", descKey: "home.institutions.features.analytics.desc", color: "bg-violet-500/10 text-violet-500" },
    { icon: ShieldCheck, titleKey: "home.institutions.features.verified.title", descKey: "home.institutions.features.verified.desc", color: "bg-amber-500/10 text-amber-500" },
    { icon: Globe, titleKey: "home.institutions.features.visibility.title", descKey: "home.institutions.features.visibility.desc", color: "bg-cyan-500/10 text-cyan-500" },
    { icon: Handshake, titleKey: "home.institutions.features.partnership.title", descKey: "home.institutions.features.partnership.desc", color: "bg-rose-500/10 text-rose-500" },
  ];

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3 mb-12"
        >
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary bg-primary/10 px-3 py-1 rounded-full">
            {t("home.institutions.badge")}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            {t("home.institutions.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("home.institutions.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={cn(
                  "flex flex-col gap-3 p-5 rounded-xl bg-card border border-border/50",
                  "hover:border-primary/30 hover:-translate-y-1 transition-all duration-200"
                )}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", feature.color.split(" ")[0])}>
                  <Icon className={cn("w-5 h-5", feature.color.split(" ")[1])} />
                </div>
                <h3 className="text-base font-semibold text-foreground">{t(feature.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(feature.descKey)}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="gap-2"
          >
            {t("home.institutions.cta")}
            <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
          </Button>
          <Button
            onClick={() => navigate("/explore-map")}
            size="lg"
            variant="outline"
            className="gap-2"
          >
            <Globe className="w-4 h-4" />
            {t("home.institutions.exploreMap")}
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
