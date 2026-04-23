import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Award, TrendingUp, Shield, Layers, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PILLARS = [
  { icon: Layers, key: "country" as const, weight: "20%" },
  { icon: TrendingUp, key: "university" as const, weight: "35%" },
  { icon: Award, key: "program" as const, weight: "45%" },
] as const;

export function OrxRankSection() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isArabic = language === "ar";

  return (
    <section className="py-20 px-6 bg-transparent relative overflow-hidden">
      {/* Subtle decorative glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center space-y-4 mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold tracking-wide">
            <Shield className="h-4 w-4" />
            {t("home.orx.badge")}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            <span className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
              ORX RANK
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            {t("home.orx.subtitle")}
          </p>
        </div>

        {/* Three Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {PILLARS.map(({ icon: Icon, key, weight }) => (
            <div
              key={key}
              className={cn(
                "group relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-7",
                "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-amber-500" />
                </div>
                <span className="text-xs font-bold text-amber-500/80 bg-amber-500/10 px-2.5 py-1 rounded-full">
                  {weight}
                </span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {t(`home.orx.pillars.${key}.title`)}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(`home.orx.pillars.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate("/orx-rank")}
            className={cn(
              "group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl",
              "bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold text-base",
              "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
              "hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
              "active:scale-[0.97] transition-all duration-200"
            )}
          >
            {t("home.orx.cta")}
            <ChevronRight className={cn("h-5 w-5 transition-transform", isArabic ? "group-hover:-translate-x-1 rotate-180" : "group-hover:translate-x-1")} />
          </button>
        </div>
      </div>
    </section>
  );
}
