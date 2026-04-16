import { MessageCircle, Search, FileText, Plane, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const stepsConfig = [
  { number: "01", icon: MessageCircle, key: "chat", color: "from-violet-500 to-purple-500" },
  { number: "02", icon: Search, key: "choose", color: "from-blue-500 to-cyan-500" },
  { number: "03", icon: FileText, key: "submit", color: "from-emerald-500 to-teal-500" },
  { number: "04", icon: Plane, key: "travel", color: "from-amber-500 to-orange-500" },
];

export const HowItWorksSection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <section className="py-24 px-6 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        <div className="text-center space-y-4 mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {t("home.howItWorks.badge")}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            {t("home.howItWorks.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("home.howItWorks.subtitle")}
          </p>
        </div>

        {/* Desktop */}
        <div className="hidden lg:block">
          <div className="relative">
            <div className="absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-blue-500 via-emerald-500 to-amber-500 opacity-30" />
            <div className="grid grid-cols-4 gap-8">
              {stepsConfig.map((step, index) => (
                <div
                  key={step.number}
                  className="relative group animate-fade-in"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="text-center space-y-6">
                    <div className="relative mx-auto">
                      <div className={cn(
                        "w-20 h-20 rounded-2xl flex items-center justify-center mx-auto",
                        "bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                        step.color
                      )}>
                        <step.icon className="w-10 h-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{step.number}</span>
                      </div>
                      <div className={cn(
                        "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300",
                        `bg-gradient-to-br ${step.color}`
                      )} />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-foreground">
                        {t(`home.howItWorks.steps.${step.key}.title`)}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {t(`home.howItWorks.steps.${step.key}.description`)}
                      </p>
                    </div>
                  </div>
                  {index < stepsConfig.length - 1 && (
                    <div className="absolute top-[88px] -right-4 transform translate-x-1/2">
                      <ArrowRight className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden space-y-8">
          {stepsConfig.map((step, index) => (
            <div
              key={step.number}
              className="flex gap-6 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center",
                  "bg-gradient-to-br shadow-lg",
                  step.color
                )}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                {index < stepsConfig.length - 1 && (
                  <div className="w-0.5 flex-1 mt-4 bg-gradient-to-b from-primary/30 to-transparent" />
                )}
              </div>
              <div className="flex-1 pb-8">
                <div className="text-xs font-bold text-primary mb-2">
                  {t("home.howItWorks.stepLabel", { number: step.number })}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {t(`home.howItWorks.steps.${step.key}.title`)}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t(`home.howItWorks.steps.${step.key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Button
            onClick={() => navigate('/universities?tab=programs')}
            size="lg"
            className="h-14 px-8 text-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {t("home.howItWorks.cta")}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};
