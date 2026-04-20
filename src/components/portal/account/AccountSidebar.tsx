import { useState } from "react";
import { LayoutDashboard, User, Paperclip, Heart, FileText, Wallet, Settings, Briefcase, ChevronDown, CreditCard, ClipboardList, LogOut, GraduationCap, ShieldCheck, FileUp, MessageCircle, Shield, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useStudentPayments } from "@/hooks/useStudentPayments";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { buildAvatarDisplayUrl } from "@/features/avatar/avatarImageUtils";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AccountSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onTabHover?: (tab: string) => void;
  progress?: number;
  currentStep?: number;
  isTeacher?: boolean;
}

export function AccountSidebar({
  activeTab,
  onTabChange,
  onTabHover,
  isTeacher = false,
}: AccountSidebarProps) {
  const [studyOpen, setStudyOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { fullLogout } = useMalakChat();
  const { crmProfile, profile } = useStudentProfile();

  const avatarBase = buildAvatarDisplayUrl(crmProfile?.avatar_url || profile?.avatar_storage_path || undefined);
  const cacheBuster = crmProfile?.avatar_updated_at;
  const avatarUrl = avatarBase
    ? `${avatarBase}${avatarBase.includes('?') ? '&' : '?'}v=${cacheBuster ? new Date(cacheBuster).getTime() : ''}`
    : undefined;
  const displayName = crmProfile?.full_name || profile?.full_name || 'C';
  const initial = (displayName.trim().charAt(0) || 'C').toUpperCase();

  const { payments } = useStudentPayments();
  const safePayments = Array.isArray(payments) ? payments : [];
  const pendingPayments = safePayments.filter(p => p.status === 'requested' || p.status === 'proof_rejected');

  // Menu items with translated labels
  const MAIN_ITEMS = [{
    id: 'overview',
    label: t('portal.sidebar.dashboard'),
    icon: LayoutDashboard
  }];

  const STUDY_ITEMS = isTeacher ? [] : [{
    id: 'study-file',
    label: t('portal.sidebar.myStudyFile'),
    icon: FolderOpen
  }, {
    id: 'shortlist',
    label: t('portal.sidebar.favorites'),
    icon: Heart
  }, {
    id: 'services',
    label: t('portal.sidebar.services'),
    icon: Briefcase
  }, {
    id: 'applications',
    label: t('portal.sidebar.applications'),
    icon: FileText
  }, {
    id: 'payments',
    label: t('portal.sidebar.payments'),
    icon: CreditCard
  }, {
    id: 'case',
    label: t('portal.sidebar.caseStatus'),
    icon: ClipboardList
  }];

  const TEACHER_ITEMS = isTeacher ? [
    {
      id: 'teacher-verification',
      label: t('portal.teacherAccount.verification'),
      icon: ShieldCheck,
      isTab: true,
    },
    {
      id: 'teacher-documents',
      label: t('portal.teacherAccount.teacherDocuments'),
      icon: FileUp,
      isTab: true,
    },
    {
      id: 'teacher-dashboard',
      label: t('portal.teacherAccount.openDashboard'),
      icon: GraduationCap,
      isTab: false,
    },
  ] : [];

  const OTHER_ITEMS = [{
    id: 'messages',
    label: t('portal.sidebar.messages', { defaultValue: 'Messages' }),
    icon: MessageCircle
  }, {
    id: 'wallet',
    label: t('portal.sidebar.wallet'),
    icon: Wallet
  }, {
    id: 'settings',
    label: t('portal.sidebar.settings'),
    icon: Settings
  }];

  const isStudyActive = STUDY_ITEMS.some(item => item.id === activeTab);
  const isOtherActive = OTHER_ITEMS.some(item => item.id === activeTab);
  
  const handleSignOut = async () => {
    setShowLogoutDialog(false);
    await fullLogout({ reason: 'manual' });
    toast.success(t('account.logoutSuccess'));
    navigate("/");
  };

  return (
    <aside className="w-56 bg-card min-h-screen sticky top-0 hidden md:block">
      {/* Logo area */}
      <div className="h-14 flex items-center justify-center">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-bold text-sm">C</span>
        </div>
      </div>

      <nav className="p-3 space-y-1">
        {/* Main Items */}
        {MAIN_ITEMS.map(item => {
          const isActive = activeTab === item.id;
          return (
            <Button 
              key={item.id} 
              variant="ghost" 
              className={cn(
                "w-full h-11 justify-start gap-3 px-3 transition-all rounded-lg relative",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )} 
              onClick={() => onTabChange(item.id)} 
              onMouseEnter={() => onTabHover?.(item.id)}
            >
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />}
              <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
              <span className="text-sm font-medium">{item.label}</span>
            </Button>
          );
        })}

        {/* Teacher Section */}
        {TEACHER_ITEMS.length > 0 && (
          <div className="pt-3 space-y-1">
            <span className="block px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('portal.teacherAccount.teaching')}
            </span>
            {TEACHER_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              const isTabItem = 'isTab' in item && item.isTab;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "w-full h-10 justify-start gap-3 px-3 pr-6 transition-all rounded-lg relative",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  onClick={() => isTabItem ? onTabChange(item.id) : navigate('/staff/teacher')}
                >
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Button>
              );
            })}
          </div>
        )}

        {/* Study & Application Section - hidden for teachers */}
        {STUDY_ITEMS.length > 0 && (
        <Collapsible open={studyOpen} onOpenChange={setStudyOpen} className="pt-3">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full h-10 justify-between px-3 transition-all rounded-lg",
                isStudyActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wider">{t('portal.sidebar.studyApplication')}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", studyOpen ? "rotate-180" : "")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            {STUDY_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <Button 
                  key={item.id} 
                  variant="ghost" 
                  className={cn(
                    "w-full h-10 justify-start gap-3 px-3 pr-6 transition-all rounded-lg relative",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )} 
                  onClick={() => onTabChange(item.id)} 
                  onMouseEnter={() => onTabHover?.(item.id)}
                >
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
                  <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm">{item.label}</span>
                </Button>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
        )}

        {/* Pending Payments Widget */}
        {pendingPayments.length > 0}

        {/* Other Items */}
        <Collapsible open={otherOpen} onOpenChange={setOtherOpen} className="pt-2">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full h-10 justify-between px-3 transition-all rounded-lg",
                isOtherActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wider">{t('portal.sidebar.other')}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", otherOpen ? "rotate-180" : "")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            {OTHER_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <Button 
                  key={item.id} 
                  variant="ghost" 
                  className={cn(
                    "w-full h-10 justify-start gap-3 px-3 pr-6 transition-all rounded-lg relative",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )} 
                  onClick={() => onTabChange(item.id)} 
                  onMouseEnter={() => onTabHover?.(item.id)}
                >
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
                  <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", item.id === 'wallet' ? "text-primary" : isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm">{item.label}</span>
                </Button>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
        
        {/* Logout Button */}
        <div className="pt-4 mt-2 border-t border-border">
          <Button 
            variant="ghost" 
            className="w-full h-10 justify-start gap-3 px-3 pr-6 transition-all rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowLogoutDialog(true)}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="text-sm">{t('account.signOut')}</span>
          </Button>
        </div>
      </nav>
      
      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="max-w-md rounded-2xl border-border/50 shadow-2xl p-8 flex flex-col">
          <AlertDialogHeader className="text-center space-y-4 order-1">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <LogOut className="w-8 h-8 text-destructive" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-center">
              {t('account.signOut')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-muted-foreground text-base leading-relaxed max-w-xs mx-auto">
              {t('account.confirmLogout')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-3 pt-6 justify-center order-2">
            <AlertDialogCancel className="flex-1 h-12 rounded-xl font-medium border-2 m-0">
              {t('btn.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSignOut} 
              className="flex-1 h-12 rounded-xl font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              <LogOut className="w-4 h-4" />
              {t('account.signOut')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
