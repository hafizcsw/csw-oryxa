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
        <DropdownMenuContent
          align="end"
          sideOffset={12}
          alignOffset={-8}
          collisionPadding={16}
          avoidCollisions
          className="w-[360px] max-w-[calc(100vw-2rem)] p-0 overflow-hidden bg-popover text-popover-foreground border border-border shadow-2xl rounded-2xl"
        >
          {/* ===== Identity Card ===== */}
          <div className="p-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 ring-2 ring-primary/30 shadow-md">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                  {(displayName || user.email || 'U')[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{displayName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <Badge variant="secondary" className="mt-1.5 h-5 px-1.5 text-[10px] font-medium">
                  {roleLabel}
                </Badge>
              </div>
            </div>

            {/* Profile completion (students only) */}
            {!hideStudentItems && !isStaff && !isAdmin && (
              <button
                onClick={() => navigate('/account')}
                className="w-full mt-3 group text-start"
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">{t('account.profileCompletion')}</span>
                  <span className={`font-semibold ${completionPercent < 100 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {completionPercent}%
                  </span>
                </div>
                <Progress value={completionPercent} className="h-1.5" />
                {completionPercent < 100 && (
                  <p className="text-[10px] text-primary mt-1 group-hover:underline">
                    {t('account.completeNow')} →
                  </p>
                )}
              </button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/account')}
              className="w-full mt-3 h-8 text-xs gap-1.5 bg-card/50 hover:bg-card"
            >
              <UserIcon className="w-3.5 h-3.5" />
              {t('account.viewProfile')}
              <ChevronRight className="w-3.5 h-3.5 ms-auto rtl:rotate-180" />
            </Button>
          </div>

          {/* ===== Quick Preferences (inline toggles) ===== */}
          <div className="p-2">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1">
              {t('account.preferences')}
            </DropdownMenuLabel>

            {/* Dark mode toggle (inline switch) */}
            <div
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-accent cursor-pointer"
              onClick={(e) => { e.preventDefault(); setTheme(isDark ? 'light' : 'dark'); }}
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-muted">
                {isDark ? <Moon className="w-4 h-4 text-foreground" /> : <Sun className="w-4 h-4 text-foreground" />}
              </span>
              <span className="text-sm font-medium flex-1">{isDark ? t('account.darkMode') : t('account.lightMode')}</span>
              <Switch checked={isDark} onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')} />
            </div>

            {/* Language submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-3 cursor-pointer py-2.5 rounded-lg">
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-muted">
                  <Languages className="w-4 h-4 text-foreground" />
                </span>
                <span className="text-sm font-medium flex-1">{t('account.language')}</span>
                <span className="text-xs text-muted-foreground me-1">
                  {LANGUAGE_INFO[language]?.flag} {LANGUAGE_INFO[language]?.nativeName}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-52 max-h-80 overflow-y-auto">
                  {SUPPORTED_LANGUAGES.map((lng) => {
                    const info = LANGUAGE_INFO[lng];
                    const active = lng === language;
                    return (
                      <DropdownMenuItem
                        key={lng}
                        onClick={() => setLanguage(lng as Language)}
                        className="gap-2 cursor-pointer"
                      >
                        <span className="text-base">{info.flag}</span>
                        <span className="text-sm flex-1">{info.nativeName}</span>
                        {active && <Check className="w-4 h-4 text-primary" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {/* Currency submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-3 cursor-pointer py-2.5 rounded-lg">
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-muted">
                  <Globe className="w-4 h-4 text-foreground" />
                </span>
                <span className="text-sm font-medium flex-1">{t('account.currency')}</span>
                <span className="text-xs text-muted-foreground me-1">{selectedCurrency}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-52">
                  {SUPPORTED_CURRENCIES.map((c) => {
                    const active = c.code === selectedCurrency;
                    return (
                      <DropdownMenuItem
                        key={c.code}
                        onClick={() => setSelectedCurrency(c.code)}
                        className="gap-2 cursor-pointer"
                      >
                        <span className="text-base">{c.flag}</span>
                        <span className="text-sm flex-1">{c.code} · {c.symbol}</span>
                        {active && <Check className="w-4 h-4 text-primary" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </div>

          <DropdownMenuSeparator />

          {/* ===== Quick Actions ===== */}
          <div className="p-2">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {t('account.quickActions')}
            </DropdownMenuLabel>

            <DropdownMenuItem onClick={handleOpenChat} className="gap-3 cursor-pointer">
              <MessageCircle className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t('account.openChat')}</p>
                <p className="text-[11px] text-muted-foreground">{t('account.openChatDesc')}</p>
              </div>
            </DropdownMenuItem>

            {!hideStudentItems && (
              <>
                <DropdownMenuItem
                  onClick={() => navigate('/languages/russian/dashboard')}
                  className="gap-3 cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4 text-violet-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('account.continueLearning')}</p>
                    <p className="text-[11px] text-muted-foreground">{t('account.continueLearningDesc')}</p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/account?tab=shortlist')}
                  className="gap-3 cursor-pointer"
                >
                  <Heart className="w-4 h-4 text-red-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('nav.favorites')}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {displayShortlistCount} {t('account.programs')}
                    </p>
                  </div>
                  {displayShortlistCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {displayShortlistCount}
                    </Badge>
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/account?tab=wallet')}
                  className="gap-3 cursor-pointer"
                >
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('account.myWallet')}</p>
                    <p className="text-[11px] text-muted-foreground">{t('account.balanceTransfers')}</p>
                  </div>
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuItem onClick={handleCopyAccountId} className="gap-3 cursor-pointer">
              <Copy className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm flex-1">{t('account.copyReferral')}</span>
            </DropdownMenuItem>
          </div>

          {/* ===== Role-specific dashboards ===== */}
          {(isTeacher || isSuperAdmin) && (
            <>
              <DropdownMenuSeparator />
              <div className="p-2">
                {(isTeacher || isSuperAdmin) && (
                  <DropdownMenuItem onClick={() => navigate('/staff/teacher')} className="gap-3 cursor-pointer">
                    <LayoutDashboard className="w-4 h-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t('account.teacherDashboard')}</p>
                      <p className="text-[11px] text-muted-foreground">{t('account.teacherDashboardDesc')}</p>
                    </div>
                  </DropdownMenuItem>
                )}
                {isSuperAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/admin')} className="gap-3 cursor-pointer">
                    <Shield className="w-4 h-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t('account.adminPanel')}</p>
                      <p className="text-[11px] text-muted-foreground">{t('account.adminPanelDesc')}</p>
                    </div>
                  </DropdownMenuItem>
                )}
              </div>
            </>
          )}

          <DropdownMenuSeparator />

          {/* ===== Footer Grid (2x2 compact) ===== */}
          <div className="grid grid-cols-2 gap-1 p-2">
            <button
              onClick={() => navigate('/')}
              className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-accent transition-colors text-xs"
            >
              <Home className="w-4 h-4 text-blue-500" />
              <span>{t('account.home')}</span>
            </button>
            <button
              onClick={() => navigate('/support')}
              className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-accent transition-colors text-xs"
            >
              <HelpCircle className="w-4 h-4 text-amber-500" />
              <span>{t('account.support')}</span>
            </button>
            <button
              onClick={() => navigate('/privacy-policy')}
              className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-accent transition-colors text-xs"
            >
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span>{t('legal.privacyPolicy')}</span>
            </button>
            <button
              onClick={() => setShowLogoutDialog(true)}
              className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-destructive/10 text-destructive transition-colors text-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('account.signOut')}</span>
            </button>
          </div>
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
