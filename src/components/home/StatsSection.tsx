import { useEffect, useState, useRef } from "react";
import { Users, Globe, Award, TrendingUp, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface StatItem {
  icon: React.ElementType;
  value: number;
  suffix: string;
  labelKey: string;
  color: string;
}

const stats: StatItem[] = [
  { icon: Users, value: 5000, suffix: "+", labelKey: "students", color: "from-blue-500 to-cyan-500" },
  { icon: Building2, value: 150, suffix: "+", labelKey: "universities", color: "from-purple-500 to-pink-500" },
  { icon: Globe, value: 25, suffix: "+", labelKey: "countries", color: "from-emerald-500 to-teal-500" },
  { icon: Award, value: 98, suffix: "%", labelKey: "success", color: "from-amber-500 to-orange-500" },
];

const useCountUp = (end: number, duration: number = 2000, start: boolean = false) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, start]);

  return count;
};

const StatCard = ({ stat, index, isVisible }: { stat: StatItem; index: number; isVisible: boolean }) => {
  const count = useCountUp(stat.value, 2000, isVisible);
  const Icon = stat.icon;
  const { t } = useLanguage();

  return (
    <div
      className={cn(
        "relative group p-8 rounded-2xl bg-card border border-border/50",
        "hover:border-primary/30 hover:shadow-xl transition-all duration-500",
        "animate-fade-in"
      )}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <div className={cn(
        "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500",
        `bg-gradient-to-br ${stat.color}`
      )} />

      <div className={cn(
        "w-16 h-16 rounded-xl flex items-center justify-center mb-6",
        "bg-gradient-to-br shadow-lg",
        stat.color
      )}>
        <Icon className="w-8 h-8 text-white" />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold text-foreground">
            {count.toLocaleString()}
          </span>
          <span className={cn(
            "text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
            stat.color
          )}>
            {stat.suffix}
          </span>
        </div>
        <p className="text-muted-foreground text-lg font-medium">
          {t(`home.stats.items.${stat.labelKey}`)}
        </p>
      </div>

      <div className={cn(
        "absolute top-4 right-4 w-20 h-20 rounded-full opacity-10",
        `bg-gradient-to-br ${stat.color}`
      )} />
    </div>
  );
};

export const StatsSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-20 px-6 bg-gradient-to-b from-muted/50 to-background relative overflow-hidden"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        <div className="text-center space-y-3 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <TrendingUp className="w-4 h-4" />
            {t("home.stats.badge")}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            {t("home.stats.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("home.stats.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatCard
              key={stat.labelKey}
              stat={stat}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
