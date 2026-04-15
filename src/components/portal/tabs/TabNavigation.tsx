import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const STUDY_ORDER = ['profile', 'readiness', 'documents', 'shortlist', 'services', 'applications', 'visa'];

interface TabNavigationProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export function TabNavigation({ currentTab, onTabChange }: TabNavigationProps) {
  const { t } = useLanguage();
  const currentIndex = STUDY_ORDER.indexOf(currentTab);
  const prevTab = currentIndex > 0 ? STUDY_ORDER[currentIndex - 1] : null;
  const nextTab = currentIndex < STUDY_ORDER.length - 1 ? STUDY_ORDER[currentIndex + 1] : null;

  const TAB_KEYS: Record<string, string> = {
    profile: 'portal.sidebar.profile',
    readiness: 'portal.sidebar.readiness',
    documents: 'portal.sidebar.documents',
    shortlist: 'portal.sidebar.favorites',
    applications: 'portal.sidebar.applications',
    services: 'portal.sidebar.services',
    visa: 'portal.sidebar.visa',
  };

  return (
    <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
      <Button 
        variant="outline" 
        onClick={() => prevTab && onTabChange(prevTab)}
        disabled={!prevTab}
        className="gap-2"
      >
        <ChevronRight className="h-4 w-4" />
        {prevTab ? t(TAB_KEYS[prevTab]) : t('portal.sidebar.profile')}
      </Button>

      <span className="text-sm text-muted-foreground font-medium">
        {currentIndex + 1} / {STUDY_ORDER.length}
      </span>

      <Button 
        onClick={() => nextTab && onTabChange(nextTab)}
        disabled={!nextTab}
        className="gap-2"
      >
        {nextTab ? t(TAB_KEYS[nextTab]) : t('portal.sidebar.visa')}
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}
