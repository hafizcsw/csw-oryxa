import { User, FileText, Paperclip, CreditCard, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ElementType;
  badge?: number;
}

interface VerticalNavSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  pendingDocs?: number;
  pendingPayments?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'profile', labelKey: 'portal.sidebar.profile', icon: User },
  { id: 'applications', labelKey: 'portal.sidebar.applications', icon: FileText },
  { id: 'documents', labelKey: 'portal.sidebar.documents', icon: Paperclip },
  { id: 'payments', labelKey: 'portal.sidebar.payments', icon: CreditCard },
];

export function VerticalNavSidebar({ 
  activeSection, 
  onSectionChange,
  pendingDocs = 0,
  pendingPayments = 0
}: VerticalNavSidebarProps) {
  const { t } = useLanguage();

  const getBadge = (id: string) => {
    if (id === 'documents' && pendingDocs > 0) return pendingDocs;
    if (id === 'payments' && pendingPayments > 0) return pendingPayments;
    return undefined;
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground px-3 mb-4">{t('portal.nav.sections')}</h3>
      
      {NAV_ITEMS.map((item, index) => {
        const isActive = activeSection === item.id;
        const Icon = item.icon;
        const badge = getBadge(item.id);

        return (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSectionChange(item.id)}
            className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all text-right ${
              isActive
                ? 'bg-primary/10 dark:bg-primary/20 border border-primary/30 text-primary'
                : 'hover:bg-muted/50 text-foreground'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{t(item.labelKey)}</span>
            </div>

            <div className="flex items-center gap-2">
              {badge && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  {badge}
                </span>
              )}
              {isActive && (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
