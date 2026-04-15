import { User, FileText, Heart, ClipboardList, Headphones, Plane } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface StudyApplicationSectionProps {
  onNavigate: (tab: string) => void;
  activeTab?: string;
}

export function StudyApplicationSection({
  onNavigate,
  activeTab
}: StudyApplicationSectionProps) {
  const { t } = useLanguage();

  const menuItems = [{
    id: "profile",
    label: t('portal.menu.data'),
    icon: User
  }, {
    id: "documents",
    label: t('portal.menu.docs'),
    icon: FileText
  }, {
    id: "favorites",
    label: t('portal.menu.favorites'),
    icon: Heart
  }, {
    id: "applications",
    label: t('portal.menu.requests'),
    icon: ClipboardList
  }, {
    id: "services",
    label: t('portal.menu.services'),
    icon: Headphones
  }, {
    id: "visa",
    label: t('portal.menu.visa'),
    icon: Plane
  }];

  return (
    <div className="space-y-4">
      {/* Menu Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button 
              key={item.id} 
              onClick={() => onNavigate(item.id)} 
              className={`
                flex flex-col items-center justify-center gap-2 p-4 rounded-xl
                transition-all duration-200 border
                ${isActive ? "bg-primary/10 border-primary text-primary" : "bg-card border-border hover:bg-muted/50 hover:border-muted-foreground/20 text-muted-foreground hover:text-foreground"}
              `}
            >
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center
                ${isActive ? "bg-primary/20" : "bg-muted"}
              `}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
