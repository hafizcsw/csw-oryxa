import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  Globe, GraduationCap, DollarSign, Search, Shield, BarChart3
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type SectionId = "basic" | "programs" | "pricing" | "seo" | "csw" | "uniranks";

interface TabSection {
  id: SectionId;
  labelKey: string;
  icon: React.ReactNode;
  badge?: number | string;
  color?: string;
}

interface StudioTabsProps {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  programCounts?: { total: number; published: number };
  children: React.ReactNode;
}

const SECTION_COLORS: Record<SectionId, string> = {
  basic: "text-primary",
  programs: "text-primary",
  pricing: "text-primary",
  seo: "text-primary",
  csw: "text-primary",
  uniranks: "text-primary",
};

export function StudioTabs({
  activeSection,
  onSectionChange,
  programCounts = { total: 0, published: 0 },
  children,
}: StudioTabsProps) {
  const { t } = useLanguage();
  
  const sections: TabSection[] = [
    { id: "basic", labelKey: "studio.tabs.basic", icon: <Globe className="h-4 w-4" />, color: SECTION_COLORS.basic },
    { 
      id: "programs", 
      labelKey: "studio.tabs.programs", 
      icon: <GraduationCap className="h-4 w-4" />, 
      badge: programCounts.total > 0 ? `${programCounts.published}/${programCounts.total}` : undefined,
      color: SECTION_COLORS.programs 
    },
    { id: "pricing", labelKey: "studio.tabs.pricing", icon: <DollarSign className="h-4 w-4" />, color: SECTION_COLORS.pricing },
    { id: "seo", labelKey: "studio.tabs.seo", icon: <Search className="h-4 w-4" />, color: SECTION_COLORS.seo },
    { id: "csw", labelKey: "studio.tabs.csw", icon: <Shield className="h-4 w-4" />, color: SECTION_COLORS.csw },
    { id: "uniranks", labelKey: "studio.tabs.uniranks", icon: <BarChart3 className="h-4 w-4" />, color: SECTION_COLORS.uniranks },
  ];

  return (
    <Tabs
      value={activeSection}
      onValueChange={(v) => onSectionChange(v as SectionId)}
      className="w-full"
    >
      {/* Modern Pill Tabs */}
      <TabsList className="flex w-full h-14 mb-6 p-1.5 bg-muted/50 rounded-2xl overflow-x-auto gap-1">
        {sections.map((section) => (
          <TabsTrigger
            key={section.id}
            value={section.id}
            className={cn(
              "relative flex-1 min-w-[80px] h-full gap-2 rounded-xl text-sm font-medium",
              "transition-all duration-300 ease-out",
              "data-[state=active]:bg-background data-[state=active]:shadow-md",
              "data-[state=active]:ring-1 data-[state=active]:ring-border/50",
              "hover:bg-background/50"
            )}
          >
            <span className={cn(
              "transition-colors duration-200",
              activeSection === section.id ? section.color : "text-muted-foreground"
            )}>
              {section.icon}
            </span>
            <span className="hidden sm:inline">{t(section.labelKey)}</span>
            {section.badge && (
              <Badge 
                variant="secondary" 
                className={cn(
                  "hidden md:flex text-[10px] px-1.5 py-0 h-5",
                  activeSection === section.id && "bg-primary/10 text-primary"
                )}
              >
                {section.badge}
              </Badge>
            )}
            
            {/* Active Indicator Dot */}
            {activeSection === section.id && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Tab Content with Animation */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-6 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </Tabs>
  );
}

export type { SectionId };
