import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DSButton } from "@/components/design-system/DSButton";
import { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { track } from "@/lib/analytics";
import { syncGuestDraftToAuth } from "@/hooks/useGuestShortlist";
import { Button } from "@/components/ui/button";
import { UserCircle, LogOut, User as UserIcon, Wallet, ArrowRightLeft, Heart, Coins, Shield, GraduationCap, LayoutDashboard, AlertCircle, MessageCircle, Calendar, Home, Moon, Sun, Globe, Languages, Settings, HelpCircle, Copy, Sparkles, ChevronRight, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useCurrency, SUPPORTED_CURRENCIES } from "@/contexts/CurrencyContext";
import { SUPPORTED_LANGUAGES, LANGUAGE_INFO, type Language } from "@/i18n/languages";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useStaffAuthority } from "@/hooks/useStaffAuthority";
import { useTeacherPermissions } from "@/lib/teacherPermissions";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildAvatarDisplayUrl } from "@/features/avatar/avatarImageUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
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

export function HeaderAuth() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { selectedCurrency, setSelectedCurrency } = useCurrency();
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const { isAdmin } = useIsAdmin();
  const { isStaff, role } = useStaffAuthority();
  const permissions = useTeacherPermissions(role);
  const isTeacher = isStaff && role === 'teacher';
  const isSuperAdmin = isStaff && role === 'super_admin';
  const pathname = window.location.pathname;
  const hideStudentItems = isTeacher && pathname.startsWith('/staff') && !isSuperAdmin;
  const { studentPortalToken, shortlist, stage, customerId, openChat, fullLogout, openAuthModal, crmAvatarUrl } = useMalakChat();
  const { crmProfile, profile } = useStudentProfile();

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const isVerifiedUser = Boolean(studentPortalToken) ||
                         (stage === 'authenticated' && Boolean(customerId));

  // ✅ دائماً استخدم shortlist من Context - المصدر الصحيح الموحد
  const displayShortlistCount = shortlist.length;

  // ✅ Cache-busting helper - supports full URLs and storage paths
  const getAvatarUrlWithCacheBust = (value: string | null | undefined): string | undefined => {
    const resolvedUrl = buildAvatarDisplayUrl(value);
    if (!resolvedUrl) return undefined;

    const separator = resolvedUrl.includes('?') ? '&' : '?';
    const cacheBuster = crmProfile?.avatar_updated_at
      ? `${separator}v=${new Date(crmProfile.avatar_updated_at).getTime()}`
      : `${separator}v=${Date.now()}`;

    return `${resolvedUrl}${cacheBuster}`;
  };

  // ✅ Track avatar from all valid sources (CRM URL, storage path, context, metadata)
  useEffect(() => {
    const metadataAvatar =
      typeof user?.user_metadata?.avatar_url === 'string'
        ? user.user_metadata.avatar_url
        : (typeof user?.user_metadata?.picture === 'string' ? user.user_metadata.picture : undefined);

    const nextAvatar =
      getAvatarUrlWithCacheBust(crmProfile?.avatar_url) ||
      getAvatarUrlWithCacheBust(profile?.avatar_storage_path) ||
      getAvatarUrlWithCacheBust(crmAvatarUrl) ||
      getAvatarUrlWithCacheBust(metadataAvatar);

    setAvatarUrl(nextAvatar);
  }, [crmProfile?.avatar_url, crmProfile?.avatar_updated_at, profile?.avatar_storage_path, crmAvatarUrl, user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setAvatarUrl(undefined);
      }
      
      // ✅ Fix #1: منع تكرار auth_signed_in باستخدام localStorage
      if (event === 'SIGNED_IN' && session?.user) {
        const userId = session.user.id;
        const key = `auth_signed_in_last:${userId}`;
        const now = Date.now();
        const last = Number(localStorage.getItem(key) || "0");
        
        // منع التكرار خلال 30 دقيقة
        if (now - last < 30 * 60 * 1000) {
          console.log('[HeaderAuth] ⏭️ Skipping duplicate auth_signed_in');
          return;
        }
        
        localStorage.setItem(key, String(now));
        setTimeout(() => {
          handlePostLogin(session.user);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

   const handlePostLogin = async (user: User) => {
     track("auth_signed_in", { user_id: user.id });
     // ✅ Sync guest shortlist draft to authenticated account
     const syncResult = await syncGuestDraftToAuth();
     if (syncResult.synced > 0) {
       console.log(`[HeaderAuth] ✅ Synced ${syncResult.synced} guest shortlist items to account`);
     }
     console.log('[HeaderAuth] Post-login complete');
   };

  const handleSignOut = async () => {
    setShowLogoutDialog(false);
    await fullLogout({ reason: 'manual' });
    toast.success(t('account.logoutSuccess'));
    navigate("/");
  };

  // ✅ Single Entry Point: Simple navigation - NO fetch, NO portal-verify
  const handleGoToAccount = () => {
    // ✅ Check auth pending first
    const pendingUntil = sessionStorage.getItem('portal_auth_pending_until');
    if (pendingUntil && Date.now() < parseInt(pendingUntil, 10)) {
      console.log('[HeaderAuth] ✅ Auth pending, navigating to /account');
      navigate('/account');
      return;
    }
    
    // ✅ If has Supabase session → navigate directly
    if (user) {
      navigate('/account');
      return;
    }
    
    // ✅ If has token → go to /account (exchange happens there ONLY)
    if (studentPortalToken) {
      console.log('[HeaderAuth] ✅ Token exists, navigating to /account');
      navigate('/account');
      return;
    }
    
    // ✅ No session, no token, no pending → navigate to auth page
    navigate('/auth');
  };

  // ==================== غير مسجّل دخول بـ Supabase ====================
  // ✅ FIX: عرض زر "تسجيل الدخول" فقط عندما لا يوجد user (Supabase session)
  // handleGoToAccount ذكي: يذهب لـ /account إذا فيه token أو pending، وإلا يفتح AuthModal
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <DSButton 
          variant="outline" 
          size="sm" 
          onClick={handleGoToAccount} 
          className="dark:border-border dark:text-foreground dark:hover:bg-muted"
        >
          {t('nav.signIn')}
        </DSButton>
      </div>
    );
  }

  // ==================== مسجّل دخول بـ Supabase ====================
  // Check if profile is incomplete (email not confirmed or phone missing)
  const isProfileIncomplete = !isStaff && !isAdmin && (!user.email_confirmed_at || !profile?.phone);

  // Display name (CRM → profile → email local-part)
  const displayName =
    crmProfile?.full_name ||
    profile?.full_name ||
    (user.email ? user.email.split('@')[0] : t('account.profile'));

  // Role badge label
  const roleLabel = isSuperAdmin
    ? t('account.roleAdmin')
    : isTeacher
    ? t('account.roleTeacher')
    : isStaff
    ? t('account.roleStaff')
    : t('account.roleStudent');

  // Quick profile completion estimate (subset of fields, no documents fetch)
  const p: any = profile || {};
  const completionFields: Array<unknown> = [
    p.full_name, p.phone, p.country, p.citizenship,
    p.preferred_major, p.preferred_degree_level, p.budget_usd,
    p.language_preference, p.gender, p.birth_year,
  ];
  const filledCount = completionFields.filter((v) => v !== null && v !== undefined && v !== '').length;
  const completionPercent = Math.round((filledCount / completionFields.length) * 100);

  const isDark = (resolvedTheme || theme) === 'dark';

  const handleCopyAccountId = async () => {
    try {
      await navigator.clipboard.writeText(customerId || user.id);
      toast.success(t('account.referralCopied'));
    } catch {
      toast.error(t('common.error', { defaultValue: 'Error' }));
    }
  };

  const handleOpenChat = () => {
    try { openChat?.(); } catch {}
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip open={isProfileIncomplete ? undefined : false}>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="relative flex items-center gap-2 hover:opacity-80">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={avatarUrl} alt={t('account.profile')} />
                    <AvatarFallback className="bg-primary/10 dark:bg-primary/20 text-sm font-medium text-primary">
                      {user.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isProfileIncomplete && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/60" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            {isProfileIncomplete && (
              <TooltipContent side="bottom" className="bg-destructive text-destructive-foreground text-xs font-medium">
                {t('account.completeAccountNotice')}
              </TooltipContent>
            )}
        <DropdownMenuContent align="end" className="w-56 bg-card border-border">
          <DropdownMenuItem
            onClick={() => navigate("/account")}
            className="gap-3 cursor-pointer"
          >
            <UserIcon className="w-4 h-4 text-primary" />
            <div>
              <p className="font-medium">{t('account.myAccount')}</p>
              <p className="text-xs text-muted-foreground">{t('account.profile')}</p>
            </div>
          </DropdownMenuItem>

          {/* Home — go to main site */}
          {!hideStudentItems && (
            <DropdownMenuItem
              onClick={() => navigate('/')}
              className="gap-3 cursor-pointer"
            >
              <Home className="w-4 h-4 text-blue-500" />
              <div>
                <p className="font-medium">{t('account.home', { defaultValue: 'Home' })}</p>
                <p className="text-xs text-muted-foreground">{t('account.homeDesc', { defaultValue: 'Back to main page' })}</p>
              </div>
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem
            onClick={() => navigate('/account?tab=wallet')}
            className="gap-3 cursor-pointer"
          >
            <Wallet className="w-4 h-4 text-emerald-500" />
            <div>
              <p className="font-medium">{t('account.myWallet')}</p>
              <p className="text-xs text-muted-foreground">{t('account.balanceTransfers')}</p>
            </div>
          </DropdownMenuItem>

          {/* Teacher Dashboard — for teachers and super_admin */}
          {(isTeacher || isSuperAdmin) && (
            <DropdownMenuItem
              onClick={() => navigate('/staff/teacher')}
              className="gap-3 cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-primary" />
              <div>
                <p className="font-medium">{t('account.teacherDashboard', { defaultValue: 'Teacher Dashboard' })}</p>
                <p className="text-xs text-muted-foreground">{t('account.teacherDashboardDesc', { defaultValue: 'Manage students & sessions' })}</p>
              </div>
            </DropdownMenuItem>
          )}

          {/* Admin Panel — for super_admin */}
          {isSuperAdmin && (
            <DropdownMenuItem
              onClick={() => navigate('/admin')}
              className="gap-3 cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-primary" />
              <div>
                <p className="font-medium">{t('account.adminPanel', { defaultValue: 'Admin Panel' })}</p>
                <p className="text-xs text-muted-foreground">{t('account.adminPanelDesc', { defaultValue: 'System administration' })}</p>
              </div>
            </DropdownMenuItem>
          )}

          {/* Student items — hidden only on staff routes for teachers */}
          {!hideStudentItems && (
            <>
              <DropdownMenuItem
                onClick={() => navigate('/languages/russian/dashboard')}
                className="gap-3 cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-medium">{t('account.myLearning')}</p>
                  <p className="text-xs text-muted-foreground">{t('account.myLearningDesc')}</p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/account?tab=shortlist')}
                className="gap-3 cursor-pointer"
              >
                <Heart className="w-4 h-4 text-red-500" />
                <div>
                  <p className="font-medium">{t('nav.favorites')}</p>
                  <p className="text-xs text-muted-foreground">{displayShortlistCount} {t('account.programs')}</p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">{t('account.premiumServices')}</DropdownMenuLabel>
              
              <DropdownMenuItem
                onClick={() => navigate('/services/transfer_soon')}
                className="gap-3 cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="font-medium">{t('account.moneyTransfer')}</p>
                  <p className="text-xs text-muted-foreground">{t('account.bestRate')}</p>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem
                onClick={() => toast.info(t('common.comingSoon'))}
                className="gap-3 cursor-pointer bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:from-amber-500/20 hover:to-amber-600/20"
              >
                <Coins className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-600 dark:text-amber-400">{t('account.investWithUs')} 💰</p>
                  <p className="text-xs text-muted-foreground">{t('account.exclusiveOpportunity')}</p>
                </div>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => navigate("/privacy-policy")}
            className="gap-3 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-muted-foreground" />
            {t('legal.privacyPolicy')}
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => setShowLogoutDialog(true)}
            className="gap-3 cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            {t('account.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>
      </TooltipProvider>
      
      {/* ✅ Logout Confirmation Dialog - Enhanced Design */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="max-w-md rounded-2xl border-border/50 shadow-2xl p-8 flex flex-col">
          {/* Header - ORDER 1 */}
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
          {/* Footer - ORDER 2 */}
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
    </div>
  );
}
