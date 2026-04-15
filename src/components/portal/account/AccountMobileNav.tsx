import { LayoutDashboard, User, Paperclip, Heart, FileText, Wallet, Plane, Menu, X, GraduationCap, ShieldCheck, FileUp, MessageCircle, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

interface AccountMobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isTeacher?: boolean;
}

export function AccountMobileNav({ activeTab, onTabChange, isTeacher = false }: AccountMobileNavProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const STUDENT_ITEMS = [
    { id: 'overview', label: t('portal.sidebar.dashboard'), icon: LayoutDashboard },
    { id: 'study-file', label: t('portal.sidebar.myStudyFile'), icon: FolderOpen },
    { id: 'shortlist', label: t('portal.sidebar.favorites'), icon: Heart },
    { id: 'applications', label: t('portal.sidebar.applications'), icon: FileText },
    { id: 'messages', label: t('portal.sidebar.messages', { defaultValue: 'Messages' }), icon: MessageCircle },
    { id: 'wallet', label: t('portal.sidebar.wallet'), icon: Wallet },
    { id: 'visa', label: t('portal.sidebar.visa'), icon: Plane },
  ];

  const TEACHER_ITEMS = [
    { id: 'overview', label: t('portal.sidebar.dashboard'), icon: LayoutDashboard },
    { id: 'teacher-verification', label: t('portal.teacherAccount.verification'), icon: ShieldCheck },
    { id: 'teacher-documents', label: t('portal.teacherAccount.teacherDocuments'), icon: FileUp },
    { id: 'teacher-dashboard', label: t('portal.teacherAccount.openDashboard'), icon: GraduationCap },
    { id: 'wallet', label: t('portal.sidebar.wallet'), icon: Wallet },
    { id: 'settings', label: t('portal.sidebar.settings'), icon: LayoutDashboard },
  ];

  const SIDEBAR_ITEMS = isTeacher ? TEACHER_ITEMS : STUDENT_ITEMS;

  const handleTabChange = (tab: string) => {
    if (tab === 'teacher-dashboard') {
      navigate('/staff/teacher');
    } else {
      onTabChange(tab);
    }
    setOpen(false);
  };

  const activeItem = SIDEBAR_ITEMS.find(item => item.id === activeTab);
  const ActiveIcon = activeItem?.icon || LayoutDashboard;

  return (
    <div className="lg:hidden border-b border-border bg-card sticky top-0 z-20">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-14 px-4 rounded-none">
            <div className="flex items-center gap-3">
              <ActiveIcon className="h-5 w-5 text-primary" />
              <span className="font-medium">{activeItem?.label || t('portal.sidebar.dashboard')}</span>
            </div>
            <Menu className="h-5 w-5 text-muted-foreground" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px] p-0">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">{t('portal.mobileNav.menu')}</h3>
          </div>
          <nav className="p-4 space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all text-right",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
