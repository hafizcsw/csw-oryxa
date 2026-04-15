import { User, FileText, Paperclip, CreditCard, Plane, Clock, Check } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface CRMSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  crmStage?: string | null;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'profile', label: 'البيانات الأساسية', icon: User },
  { id: 'applications', label: 'تفاصيل الطلب', icon: FileText },
  { id: 'documents', label: 'الوثائق والمرفقات', icon: Paperclip },
  { id: 'visa', label: 'التأشيرة والتذاكر', icon: Plane },
  { id: 'payments', label: 'الدفعات والعقود', icon: CreditCard },
  { id: 'timeline', label: 'الخط الزمني', icon: Clock },
];

export function CRMSidebar({ 
  activeSection, 
  onSectionChange,
  crmStage
}: CRMSidebarProps) {
  
  const getItemStatus = (itemId: string): 'active' | 'completed' | 'pending' => {
    if (itemId === activeSection) return 'active';
    const itemIndex = NAV_ITEMS.findIndex(item => item.id === itemId);
    const activeIndex = NAV_ITEMS.findIndex(item => item.id === activeSection);
    if (itemIndex < activeIndex) return 'completed';
    return 'pending';
  };

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item, index) => {
        const Icon = item.icon;
        const status = getItemStatus(item.id);
        const isActive = status === 'active';
        const isCompleted = status === 'completed';

        return (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
              ${isActive 
                ? 'bg-primary/10 text-primary font-medium' 
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }
            `}
          >
            {/* Status Circle */}
            <div className={`
              w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0
              ${isActive 
                ? 'bg-green-500 text-white' 
                : isCompleted 
                  ? 'bg-green-500 text-white' 
                  : 'border-2 border-muted-foreground/30 text-muted-foreground'
              }
            `}>
              {isCompleted ? (
                <Check className="w-3 h-3" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            {/* Label */}
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
