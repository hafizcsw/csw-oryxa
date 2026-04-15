import { Link, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { servicesContent } from "@/data/servicesContent";
import { cn } from "@/lib/utils";
import { 
  Home, Car, CreditCard, GraduationCap, Heart, Wifi, FileCheck, Banknote
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Icon mapping with colors for services
const serviceConfig: Record<string, { icon: React.ElementType; color: string; activeGradient: string }> = {
  accommodation: { 
    icon: Home, 
    color: "text-green-600 dark:text-green-400",
    activeGradient: "from-green-500 to-emerald-600"
  },
  airport: { 
    icon: Car, 
    color: "text-blue-600 dark:text-blue-400",
    activeGradient: "from-blue-500 to-cyan-600"
  },
  bank: { 
    icon: CreditCard, 
    color: "text-purple-600 dark:text-purple-400",
    activeGradient: "from-purple-500 to-violet-600"
  },
  course: { 
    icon: GraduationCap, 
    color: "text-indigo-600 dark:text-indigo-400",
    activeGradient: "from-indigo-500 to-blue-600"
  },
  health: { 
    icon: Heart, 
    color: "text-red-500 dark:text-red-400",
    activeGradient: "from-red-500 to-rose-600"
  },
  sim: { 
    icon: Wifi, 
    color: "text-cyan-600 dark:text-cyan-400",
    activeGradient: "from-cyan-500 to-teal-600"
  },
  visa: { 
    icon: FileCheck, 
    color: "text-orange-600 dark:text-orange-400",
    activeGradient: "from-orange-500 to-amber-600"
  },
  transfer_soon: { 
    icon: Banknote, 
    color: "text-yellow-600 dark:text-yellow-400",
    activeGradient: "from-yellow-500 to-orange-600"
  },
};

export function ServicesNavBar() {
  const { slug: currentSlug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const services = Object.entries(servicesContent);

  return (
    <div className="sticky top-16 z-40 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-md border-b border-border/30 shadow-lg">
      <div className="container mx-auto px-4">
        <ScrollArea className="w-full" dir={isRTL ? "rtl" : "ltr"}>
          <div className="flex items-center gap-3 py-4">
            {services.map(([key, service], index) => {
              const isActive = key === currentSlug;
              const config = serviceConfig[key] || { 
                icon: FileCheck, 
                color: "text-muted-foreground",
                activeGradient: "from-primary to-purple-600"
              };
              const IconComponent = config.icon;
              const isComingSoon = service.comingSoon;

              return (
                <Link
                  key={key}
                  to={`/services/${key}`}
                  className={cn(
                    "group flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 animate-fade-in border",
                    isActive
                      ? `bg-gradient-to-r ${config.activeGradient} text-white shadow-lg shadow-primary/25 border-transparent scale-105`
                      : "bg-background/80 text-foreground border-border/50 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 hover:bg-background",
                    isComingSoon && "opacity-60 cursor-not-allowed"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={isComingSoon ? (e) => e.preventDefault() : undefined}
                >
                  <div className={cn(
                    "p-1.5 rounded-lg transition-all duration-300",
                    isActive 
                      ? "bg-white/20" 
                      : "bg-muted/50 group-hover:bg-primary/10"
                  )}>
                    <IconComponent className={cn(
                      "w-5 h-5 transition-all duration-300",
                      isActive ? "text-white" : config.color
                    )} />
                  </div>
                  <span className="font-semibold">
                    {isRTL ? service.heroTitleAr : service.heroTitleEn}
                  </span>
                  {isComingSoon && (
                    <span className="text-xs bg-amber-500/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full animate-pulse font-medium">
                      {isRTL ? "قريباً" : "Soon"}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="h-2" />
        </ScrollArea>
      </div>
    </div>
  );
}
