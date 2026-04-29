import { ReactNode, useState, lazy, Suspense } from "react";
import { NavHintBadges } from "./NavHintBadges";
import { useUniversityShortlistHook } from "@/hooks/useUniversityShortlist";
import { HeaderAuth } from "./HeaderAuth";
import { WalletHeaderWidget } from "./WalletHeaderWidget";
import { CurrencySelector } from "@/components/CurrencySelector";
import { Footer } from "./Footer";
import { CompareFloatingButton } from "@/components/CompareFloatingButton";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield, Heart, Building2, GraduationCap, Search, MessageCircle, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import logo from "@/assets/logo-connect-study-world.png";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { usePortalShortlist } from "@/hooks/usePortalShortlist";
import { useGuestAwareShortlist } from "@/hooks/useGuestShortlist";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useStaffAuthority } from "@/hooks/useStaffAuthority";
import { useTeacherPermissions } from "@/lib/teacherPermissions";

// Lazy-loaded heavy overlays — not needed for first paint
const ShortlistDrawer = lazy(() => import("@/components/shortlist/ShortlistDrawer").then(m => ({ default: m.ShortlistDrawer })));
const AuthStartModal = lazy(() => import("@/components/auth/AuthStartModal").then(m => ({ default: m.AuthStartModal })));
const HeaderMessenger = lazy(() => import("./HeaderMessenger").then(m => ({ default: m.HeaderMessenger })));

interface LayoutProps {
  children: ReactNode;
}
export function Layout({
  children
}: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAdmin
  } = useIsAdmin();
  const {
    showAuthModal,
    closeAuthModal
  } = useMalakChat();
  const {
    count: portalCount,
    limit: portalLimit,
    isAuthenticated
  } = usePortalShortlist();
  const guestShortlist = useGuestAwareShortlist();
  const { count: uniCount } = useUniversityShortlistHook();
  const [showShortlistDrawer, setShowShortlistDrawer] = useState(false);
  const { t } = useLanguage();
  const { isStaff, role } = useStaffAuthority();
  const permissions = useTeacherPermissions(role);
  const isTeacher = isStaff && role === 'teacher';
  const isSuperAdmin = isStaff && role === 'super_admin';

  // Detect language learning section (dashboard, modules, lessons, etc.)
  const pathname = location?.pathname || '';
  const isLanguageSection = isAuthenticated && (
    /^\/languages\/[a-z]+\/(dashboard|module|lesson)/i.test(pathname) ||
    pathname === '/my-learning'
  );

  // Teacher nav gating only applies on staff routes — on public/student routes, show full nav
  const isOnStaffRoute = pathname.startsWith('/staff');
  const hideStudentNav = isTeacher && isOnStaffRoute && !isSuperAdmin;

  // Staff routes with their own nav (BusuuNavBar) — hide Layout chrome entirely
  const hideLayoutChrome = isOnStaffRoute && isTeacher;

  // ✅ #7.3: Combined count (programs + universities) — guests see localStorage draft count
  const displayCount = isAuthenticated ? (portalCount + uniCount) : guestShortlist.count;
  const displayLimit = portalLimit || 10; // Always 10, never 5
  const handleAdmin = () => {
    navigate('/admin');
  };
  // If teacher is on staff route, render only the children (they have their own nav)
  if (hideLayoutChrome) {
    return (
      <div className="min-h-screen bg-background isolate">
        <main className="relative z-0">{children}</main>
      </div>
    );
  }

  return <div className="min-h-screen bg-background isolate">
      {/* Hint Badges for Currency & Shortlist */}
      <NavHintBadges />
      

      {/* Main Header - Adapts to dark mode */}
      <header className="sticky top-0 z-[90] border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 dark:shadow-lg dark:shadow-black/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 sm:py-2.5 flex items-center justify-between">
          {/* Logo + Global Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/" className="flex items-center hover:opacity-90 transition-opacity" onClick={e => {
            e.preventDefault();
            navigate("/");
          }}>
              <div className="bg-white dark:bg-white/95 rounded-lg sm:rounded-xl p-1 sm:p-1.5 shadow-sm dark:shadow-lg transition-all">
                <img src={logo} alt={t("auth.logoAlt")} className="h-6 sm:h-8 md:h-10 w-auto object-contain" />
              </div>
            </a>

            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-1.5 py-1 shadow-sm">
              <ThemeToggle />
              <LanguageToggle />
            </div>
          </div>
          
          {/* Navigation Links */}
          {isLanguageSection ? (
            /* Preply-style minimal nav for language learners */
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
              <button 
                onClick={() => navigate('/languages')}
                className="px-3 py-1.5 rounded-lg text-foreground/80 hover:text-primary hover:bg-primary/5 dark:text-foreground/90 dark:hover:text-primary dark:hover:bg-primary/10 transition-all flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                {t("nav.findTutor")}
              </button>
              <button 
                onClick={() => navigate('/languages/russian/dashboard?tab=messages')}
                className="px-3 py-1.5 rounded-lg text-foreground/80 hover:text-primary hover:bg-primary/5 dark:text-foreground/90 dark:hover:text-primary dark:hover:bg-primary/10 transition-all flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {t("nav.messages")}
              </button>
              <button 
                onClick={() => navigate('/languages/russian/dashboard?tab=sessions')}
                className="px-3 py-1.5 rounded-lg text-foreground/80 hover:text-primary hover:bg-primary/5 dark:text-foreground/90 dark:hover:text-primary dark:hover:bg-primary/10 transition-all flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                {t("nav.mySessions")}
              </button>
              <button 
                onClick={() => navigate('/languages/russian/dashboard')}
                className="px-3 py-1.5 rounded-lg text-foreground/80 hover:text-primary hover:bg-primary/5 dark:text-foreground/90 dark:hover:text-primary dark:hover:bg-primary/10 transition-all flex items-center gap-1.5"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                {t("nav.myLessons")}
              </button>
            </nav>
          ) : !hideStudentNav ? (
            /* Standard full nav — all buttons styled at ORX strength */
            <nav className={cn(
              "hidden lg:flex items-center gap-0.5 font-bold whitespace-nowrap [&_button]:whitespace-nowrap",
              "text-[13px] xl:text-[14px]"
            )}>
              <button
                onClick={() => navigate('/')}
                className="px-3 py-1.5 rounded-lg text-foreground hover:text-primary hover:bg-primary/5 dark:text-foreground dark:hover:text-primary dark:hover:bg-primary/10 transition-all font-bold"
              >
                {t("nav.home")}
              </button>
              <button
                onClick={() => navigate('/countries')}
                className="px-3 py-1.5 rounded-lg text-foreground hover:text-primary hover:bg-primary/5 dark:text-foreground dark:hover:text-primary dark:hover:bg-primary/10 transition-all font-bold"
              >
                {t("nav.studyDestinations")}
              </button>
              <button onClick={() => navigate("/universities?tab=universities")} className="px-3 py-1.5 rounded-lg text-foreground hover:text-primary hover:bg-primary/5 dark:text-foreground dark:hover:text-primary dark:hover:bg-primary/10 transition-all font-bold">
                {t("nav.findUniversity")}
              </button>
              <button onClick={() => navigate("/languages")} className="px-3 py-1.5 rounded-lg text-foreground hover:text-primary hover:bg-primary/5 dark:text-foreground dark:hover:text-primary dark:hover:bg-primary/10 transition-all font-bold">
                {t("nav.languages")}
              </button>
              <button onClick={() => navigate("/orx-rank")} className="px-3 py-1.5 rounded-lg text-foreground hover:text-primary hover:bg-primary/5 dark:text-foreground dark:hover:text-primary dark:hover:bg-primary/10 transition-all font-bold">
                {t("orx.nav.orxRank")}
              </button>
              <button onClick={() => navigate("/social")} className="px-3 py-1.5 rounded-lg text-foreground hover:text-primary hover:bg-primary/5 dark:text-foreground dark:hover:text-primary dark:hover:bg-primary/10 transition-all flex items-center gap-1 font-bold">
                <Users className="w-3.5 h-3.5" />
                {t("nav.community")}
              </button>
            </nav>
          ) : null}

          {/* Right Side Actions */}
          <div className="flex items-center gap-0.5 sm:gap-2">
            
            {/* 1. Currency + Wallet */}
            {!hideStudentNav && (
            <div className="hidden sm:flex items-center gap-1">
              <CurrencySelector />
              <WalletHeaderWidget />
            </div>
            )}


            {/* 3. Shortlist Heart Button */}
            {!hideStudentNav && (
            <Button id="shortlist-heart-anchor" variant="ghost" size="sm" onClick={() => setShowShortlistDrawer(true)} data-shortlist-target className="relative flex items-center gap-1 sm:gap-2 hover:bg-primary/10 dark:hover:bg-primary/20 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg">
              <Heart className={cn("w-4 h-4 sm:w-5 sm:h-5 transition-colors", displayCount > 0 ? "fill-destructive text-destructive" : "text-muted-foreground")} />
              <Badge variant="secondary" className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2", displayCount >= displayLimit && "bg-destructive text-destructive-foreground")}>
                {displayCount}/{displayLimit}
              </Badge>
            </Button>
            )}

            {/* 4. Admin Buttons - Only visible to super admin, hidden in language section */}
            {isAdmin && !isLanguageSection && (
              <>
                <Button variant="ghost" size="icon" onClick={() => navigate('/staff/teacher')} className="rounded-full hover:bg-muted transition-all h-8 w-8 sm:h-10 sm:w-10" title={t("staff.teacher.dashboard_title", { defaultValue: "Teacher Dashboard" })}>
                  <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleAdmin} className="rounded-full hover:bg-muted transition-all h-8 w-8 sm:h-10 sm:w-10" title={t("admin.dashboard")}>
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </Button>
              </>
            )}

            {/* Notifications (authenticated only) — placed right next to avatar */}
            {isAuthenticated && !hideStudentNav && (
              <Suspense fallback={null}><HeaderMessenger /></Suspense>
            )}

            {/* 5. Account/Auth */}
            <HeaderAuth />
          </div>
        </div>
      </header>
      
      <main className="relative z-0">{children}</main>
      
      {/* Footer */}
      <Footer />
      
      <CompareFloatingButton />
      
      {/* Lazy overlays — invisible until triggered */}
      <Suspense fallback={null}>
        <AuthStartModal open={showAuthModal} onOpenChange={closeAuthModal} />
        <ShortlistDrawer open={showShortlistDrawer} onOpenChange={setShowShortlistDrawer} />
      </Suspense>
    </div>;
}
