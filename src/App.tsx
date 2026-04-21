import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate, useParams } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { StudentTourProvider } from "@/contexts/StudentTourContext";
import { MalakChatProvider, useMalakChat } from "@/contexts/MalakChatContext";
import { StudentSiteTour } from "@/components/onboarding/StudentSiteTour";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AuthStartModal } from "@/components/auth/AuthStartModal";
import { WelcomeTransition } from "@/components/auth/WelcomeTransition";
import { welcomeAlreadyRouted } from "@/lib/welcomeTransition";
import { PhoneActivationGate } from "@/components/auth/PhoneActivationGate";
import { CanonicalRedirect } from "@/components/system/CanonicalRedirect";
import { SearchRedirect } from "@/components/system/SearchRedirect";
import { ScrollToTop } from "@/components/system/ScrollToTop";
import { RoutePrefetcher } from "@/components/system/RoutePrefetcher";
import { LocaleRouteWrapper } from "@/components/routing/LocaleRouteWrapper";
import { lazy, Suspense, useEffect, useState } from "react";
import { usePresenceHeartbeat } from "@/hooks/usePresence";
import FloatingChat from "@/components/FloatingChat";
import { PortalAuthFloater } from "@/components/portal/support/PortalAuthFloater";
import { Layout } from "@/components/layout/Layout";
import { InstitutionGuard } from "@/components/institution/InstitutionGuard";
import { StaffGuard } from "@/components/staff/StaffGuard";
import { InstitutionDashboardLayout } from "@/components/institution/InstitutionDashboardLayout";
import { InstitutionPreviewProvider } from "@/contexts/InstitutionPreviewContext";
import { InstitutionPickerModal } from "@/components/institution/InstitutionPickerModal";
import { CrmTestPanel } from "@/components/dev/CrmTestPanel";
import { supabase } from "@/integrations/supabase/client";
import { useVisitorTracker } from "@/hooks/useVisitorTracker";
import { useHtmlLangDir } from "@/i18n/useHtmlLangDir";
// Note: initWebVitals is initialized in main.tsx only
import { PageLoader } from "@/components/ui/PageLoader";

// ===== SYNC IMPORTS (Critical pages loaded immediately) =====
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// ===== LAZY IMPORTS (Loaded on demand) =====

// Public Pages
// Universities component serves /search (canonical route); /universities redirects to /search
const Universities = lazy(() => import("./pages/Universities"));
const Countries = lazy(() => import("./pages/Countries"));
const UniversityDetails = lazy(() => import("./pages/UniversityDetails"));
const ProgramDetails = lazy(() => import("./pages/ProgramDetails"));
const Country = lazy(() => import("./pages/Country"));
const Apply = lazy(() => import("./pages/Apply"));
const ApplyPage = lazy(() => import("./pages/ApplyPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TeacherPrivacyPolicy = lazy(() => import("./pages/TeacherPrivacyPolicy"));
const Status = lazy(() => import("./pages/Status"));
const Contact = lazy(() => import("./pages/Contact"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Account = lazy(() => import("./pages/Account"));
const MessagesPage = lazy(() => import("./pages/Messages"));
const AccountApplications = lazy(() => import("./pages/AccountApplications"));
const AccountFavorites = lazy(() => import("./pages/AccountFavorites"));
const Compare = lazy(() => import("./pages/ComparePage"));
const CompareUniversities = lazy(() => import("./pages/CompareUniversities"));
const ServiceDetails = lazy(() => import("./pages/ServiceDetails"));
const Scholarships = lazy(() => import("./pages/Scholarships"));
const StudentPortal = lazy(() => import("./pages/StudentPortal"));
const PortalToken = lazy(() => import("./pages/PortalToken"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AcceptInviteLazy = lazy(() => import("./pages/AcceptInvitePage"));
const AuthPageLazy = lazy(() => import("./pages/AuthPage"));
const ExploreMap = lazy(() => import("./pages/ExploreMap"));
const PaidServices = lazy(() => import("./pages/PaidServices"));

// Footer Pages
const About = lazy(() => import("./pages/About"));
const AboutOryxa = lazy(() => import("./pages/AboutOryxa"));
const Team = lazy(() => import("./pages/Team"));
const Partners = lazy(() => import("./pages/Partners"));
const IELTSPage = lazy(() => import("./pages/IELTS"));
const LanguagesLanding = lazy(() => import("./pages/languages/LanguagesLanding"));
const TeacherProfilePage = lazy(() => import("./pages/languages/TeacherProfilePage"));
const RussianLanding = lazy(() => import("./pages/languages/RussianLanding"));
const RussianOnboarding = lazy(() => import("./pages/languages/RussianOnboarding"));
const RussianPlan = lazy(() => import("./pages/languages/RussianPlan"));
const RussianDashboard = lazy(() => import("./pages/languages/RussianDashboard"));
const PlacementAuth = lazy(() => import("./pages/languages/PlacementAuth"));
const PlacementTest = lazy(() => import("./pages/languages/PlacementTest"));
const MyLearning = lazy(() => import("./pages/languages/MyLearning"));
const RussianModule = lazy(() => import("./pages/languages/RussianModule"));
const RussianLesson = lazy(() => import("./pages/languages/RussianLesson"));
const RussianCheckpoint = lazy(() => import("./pages/languages/RussianCheckpoint"));
const RussianExam = lazy(() => import("./pages/languages/RussianExam"));
const LanguageCourseComingSoon = lazy(() => import("./pages/languages/LanguageCourseComingSoon"));
const CoursesPage = lazy(() => import("./pages/Courses"));
const BlogPage = lazy(() => import("./pages/Blog"));
const FAQPage = lazy(() => import("./pages/FAQ"));
const WhereWeArePage = lazy(() => import("./pages/WhereWeAre"));
const CommunityPage = lazy(() => import("./pages/Community"));
const CommunityProfilePage = lazy(() => import("./pages/CommunityProfile"));
const EventsPage = lazy(() => import("./pages/Events"));
const CareersPage = lazy(() => import("./pages/Careers"));
const ForInstitutionsPage = lazy(() => import("./pages/ForInstitutions"));

// ORX RANK Pages
const OrxRankHub = lazy(() => import("./pages/OrxRankHub"));
const OrxMethodology = lazy(() => import("./pages/OrxMethodology"));
const OrxArticles = lazy(() => import("./pages/OrxArticles"));
const OrxArticleDetail = lazy(() => import("./pages/OrxArticleDetail"));
const OrxCountries = lazy(() => import("./pages/OrxCountries"));

// Translation Service Pages
const TranslationNewOrder = lazy(() => import("./pages/app/translation/TranslationNewOrderPage"));
const TranslationOrderDetails = lazy(() => import("./pages/app/translation/TranslationOrderDetailsPage"));

// Admin Pages
const Admin = lazy(() => import("./pages/Admin"));
const AdminHome = lazy(() => import("./pages/admin/Index"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminPrograms = lazy(() => import("./pages/admin/Programs"));
const UniversitiesAdmin = lazy(() => import("./pages/admin/UniversitiesAdmin"));
const InstitutionsAdmin = lazy(() => import("./pages/admin/InstitutionsAdmin"));
const AdminInstitutionView = lazy(() => import("./pages/admin/AdminInstitutionView"));
const AdminPageEditsReview = lazy(() => import("./pages/admin/AdminPageEditsReview"));
const ProgramsAdmin = lazy(() => import("./pages/admin/ProgramsAdmin"));
const ScholarshipsAdmin = lazy(() => import("./pages/admin/ScholarshipsAdmin"));
const EventsAdmin = lazy(() => import("./pages/admin/EventsAdmin"));
const AdminTestimonials = lazy(() => import("./pages/admin/Testimonials"));
const AdminCountries = lazy(() => import("./pages/admin/Countries"));
const AdminScholarships = lazy(() => import("./pages/admin/Scholarships"));
const AdminImport = lazy(() => import("./pages/admin/Import"));
const ApplicationsAdmin = lazy(() => import("./pages/admin/ApplicationsAdmin"));
const CRMBoard = lazy(() => import("./pages/admin/CRMBoard"));
const AdminIntegrationLogs = lazy(() => import("./pages/admin/IntegrationLogs"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const FeatureSettingsAdmin = lazy(() => import("./pages/admin/FeatureSettings"));
const FeatureFlags = lazy(() => import("./pages/admin/FeatureFlags"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminHealth = lazy(() => import("./pages/admin/Health"));
const UniversityEdit = lazy(() => import("./pages/admin/UniversityEdit"));
const AIAssistant = lazy(() => import("./pages/admin/AIAssistant"));
const ImportPrograms = lazy(() => import("./pages/admin/ImportPrograms"));
const AnalyticsReports = lazy(() => import("./pages/admin/AnalyticsReports"));
const Telemetry = lazy(() => import("./pages/admin/Telemetry"));
const AdminIntegrationsMonitor = lazy(() => import("./pages/admin/IntegrationsMonitor"));
const CRMKeys = lazy(() => import("./pages/admin/integrations/CRMKeys"));
const Outbox = lazy(() => import("./pages/admin/integrations/Outbox"));
const TuitionMonitor = lazy(() => import("./pages/admin/TuitionMonitor"));
const TuitionProposals = lazy(() => import("./pages/admin/TuitionProposals"));
const UniversityStudio = lazy(() => import("./pages/admin/UniversityStudio"));
const UniversityStudioPage = lazy(() => import("./pages/admin/UniversityStudioPage"));
const SeoOps = lazy(() => import("./pages/admin/SeoOps"));
const BacklinksPage = lazy(() => import("./pages/admin/seo-ops/Backlinks"));
const GSCPage = lazy(() => import("./pages/admin/seo-ops/GSC"));
const ExperimentsPage = lazy(() => import("./pages/admin/seo-ops/Experiments"));
const DataQualityDashboard = lazy(() => import("./pages/admin/DataQualityDashboard"));
const BudgetDashboard = lazy(() => import("./pages/admin/BudgetDashboard"));
const FeatureFlagsAdmin = lazy(() => import("./pages/admin/FeatureFlagsAdmin"));
const RussianUniversitiesImport = lazy(() => import("./pages/admin/RussianUniversitiesImport"));
const UnisAssistant = lazy(() => import("./pages/admin/UnisAssistant"));
const ImportStructuredData = lazy(() => import("./pages/admin/ImportStructuredData"));

const GenerateProgramScholarshipImages = lazy(() => import("./pages/admin/GenerateProgramScholarshipImages"));
const MediaReview = lazy(() => import("./pages/admin/MediaReview"));
const NewsTickerSettings = lazy(() => import("./pages/admin/NewsTickerSettings"));
const WebsiteEnrichment = lazy(() => import("./pages/admin/WebsiteEnrichment"));
const BulkPublish = lazy(() => import("./pages/admin/BulkPublish"));
const OrxControlPanel = lazy(() => import("./pages/admin/OrxControlPanel"));
const LanguageEnrollments = lazy(() => import("./pages/admin/LanguageEnrollments"));
const DecisionDashboard = lazy(() => import("./pages/admin/DecisionDashboard"));
const UniversitiesWithoutWebsitePdf = lazy(() => import("./pages/tools/UniversitiesWithoutWebsitePdf"));
const ExportNoCityPage = lazy(() => import("./pages/tools/ExportNoCityPage"));

// Institution Pages
const InstitutionOnboarding = lazy(() => import("./pages/institution/Onboarding"));
const InstitutionSearch = lazy(() => import("./pages/institution/Search"));
const InstitutionClaim = lazy(() => import("./pages/institution/Claim"));
const InstitutionPending = lazy(() => import("./pages/institution/Pending"));
const InstitutionLocked = lazy(() => import("./pages/institution/Locked"));
// Legacy institution dashboard — FROZEN for institution operators.
// These files are ONLY used by super-admin backoffice at /admin/institutions/:id/*
// The institution-user route /institution/dashboard/* redirects to / (line ~904)
const InstitutionOverview = lazy(() => import("./pages/institution/dashboard/Overview"));
const InstitutionApplications = lazy(() => import("./pages/institution/dashboard/Applications"));
const InstitutionApplicationDetail = lazy(() => import("./pages/institution/dashboard/ApplicationDetail"));
const InstitutionPageEditor = lazy(() => import("./pages/institution/dashboard/PageEditor"));
const InstitutionPrograms = lazy(() => import("./pages/institution/dashboard/Programs"));
const InstitutionTeam = lazy(() => import("./pages/institution/dashboard/Team"));
const InstitutionDocuments = lazy(() => import("./pages/institution/dashboard/Documents"));
const InstitutionAnalytics = lazy(() => import("./pages/institution/dashboard/Analytics"));
const InstitutionSettings = lazy(() => import("./pages/institution/dashboard/Settings"));

// Staff Pages (CRM authority-gated)
const StaffTeacherDashboard = lazy(() => import("./pages/staff/StaffTeacherDashboard"));
const StaffEditorLanding = lazy(() => import("./pages/staff/StaffEditorLanding"));
const StaffContentLanding = lazy(() => import("./pages/staff/StaffContentLanding"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function LegacyStudyInRedirect() {
  const { countrySlug, locale } = useParams<{ countrySlug: string; locale?: string }>();

  if (!countrySlug) {
    return <Navigate to={locale ? `/${locale}/countries` : "/countries"} replace />;
  }

  return <Navigate to={locale ? `/${locale}/country/${countrySlug}` : `/country/${countrySlug}`} replace />;
}

// Migrate guest shortlist on login (V3 - with snapshot sync + strict confirmation)
async function migrateGuestShortlistOnLogin() {
  const GUEST_KEY = "guest_shortlist";
  const CACHE_KEY = "shortlist_snapshot_cache_v1";
  
  const raw = localStorage.getItem(GUEST_KEY);
  const ids: string[] = raw ? JSON.parse(raw) : [];
  console.log('[App] migrateGuestShortlistOnLogin called, shortlist:', ids);
  
  if (!ids.length) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // ⚠️ Get snapshots from cache
  const cacheRaw = localStorage.getItem(CACHE_KEY);
  const cache: Record<string, any> = cacheRaw ? JSON.parse(cacheRaw) : {};

  const items = ids
    .map((id) => cache[id])
    .filter(Boolean); // only items with snapshots

  // لو مافيش snapshots… لا تمسح أي شيء (خليه محلي فقط)
  if (items.length === 0) {
    console.warn('[App] migrateGuestShortlistOnLogin: No snapshots found, skip sync and keep local');
    return;
  }

  console.log('[App] migrateGuestShortlistOnLogin: Syncing', items.length, 'items with snapshots');

  try {
    const { syncShortlistWithSnapshots, getShortlist } = await import('@/lib/portalApi');
    
    const res = await syncShortlistWithSnapshots(items, 'login_migration', false);
    
    // ✅ Strict success check: ok=true AND stored_count > 0
    const stored = Number((res as any)?.stored_count || 0);
    
    if ((res as any)?.ok === true && stored > 0) {
      console.log('[App] migrateGuestShortlistOnLogin: Sync reported success, verifying remote...');
      
      // ✅ Additional confirmation: refetch remote and verify > 0
      const remoteRes = await getShortlist();
      const remoteItems = remoteRes?.data?.shortlisted_programs || [];
      
      if (Array.isArray(remoteItems) && remoteItems.length > 0) {
        localStorage.removeItem(GUEST_KEY);
        console.log('[App] migrateGuestShortlistOnLogin: ✅ Cleared local after remote confirmed:', remoteItems.length, 'items');
        return;
      } else {
        console.warn('[App] migrateGuestShortlistOnLogin: ❌ Remote empty after sync, keeping local');
      }
    } else {
      console.warn('[App] migrateGuestShortlistOnLogin: ❌ Sync not confirmed (ok:', (res as any)?.ok, ', stored:', stored, '), keeping local');
    }
  } catch (err) {
    console.error('[App] migrateGuestShortlistOnLogin: ❌ Error during migration:', err);
  }
  
  // If we reach here, something failed - keep local data
  console.warn('[App] migrateGuestShortlistOnLogin: Keeping guest_shortlist as fallback');
}

function AppContent() {
  const { pathname } = useLocation();
  const navigateRouter = useNavigate();
  // Hide public AI FAB on admin/apply/maintenance AND on portal/authenticated surfaces
  // (PortalAuthFloater takes over there — never show both).
  const isPortalSurface = /^\/(account|messages|portal|student-portal)(\/|$)/.test(pathname);
  const hideFab = pathname.startsWith("/admin") || pathname.startsWith("/apply") || pathname === "/maintenance" || isPortalSurface;
  
  // Sync document language and RTL direction
  useHtmlLangDir();
  
  // 🆕 Auth Modal control from context (unified across app)
  const { showAuthModal, openAuthModal, closeAuthModal } = useMalakChat();
  
  // 🆕 Phone Activation Gate state
  const [showActivationGate, setShowActivationGate] = useState(false);
  
  // Track visitor activity
  useVisitorTracker();
  
  // Presence heartbeat — keeps user online status fresh across all pages
  usePresenceHeartbeat();
  
  // === AUTH BOOTSTRAP (RUNS ONCE ON APP LOAD) ===
  // Handles PKCE (?code=) and Implicit (#access_token) auth flows
  useEffect(() => {
    let cancelled = false;

    const bootstrapAuthFromUrl = async () => {
      try {
        // 0) Skip if session already exists
        const existing = await supabase.auth.getSession();
        if (cancelled) return;
        if (existing.data.session) {
          console.log('[AuthBootstrap] ✅ Session already exists, skipping');
          return;
        }

        // 1) PKCE: ?code=...
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          console.log('[AuthBootstrap] 🔑 Found PKCE code, exchanging...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            url.searchParams.delete("code");
            const newSearch = url.searchParams.toString();
            window.history.replaceState(
              {},
              "",
              url.pathname + (newSearch ? `?${newSearch}` : "") + url.hash
            );
            console.log('[AuthBootstrap] ✅ PKCE session established');
            return;
          } else {
            console.warn('[AuthBootstrap] ⚠️ PKCE exchange failed:', error);
          }
        }

        // 2) Implicit: #access_token & #refresh_token
        const hash = window.location.hash?.startsWith("#")
          ? window.location.hash.slice(1)
          : "";

        if (hash) {
          const hashParams = new URLSearchParams(hash);
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");

          if (access_token && refresh_token) {
            console.log('[AuthBootstrap] 🔑 Found implicit tokens, setting session...');
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (!error) {
              window.history.replaceState(
                {},
                "",
                window.location.pathname + window.location.search
              );
              console.log('[AuthBootstrap] ✅ Implicit session established');
              return;
            } else {
              console.warn('[AuthBootstrap] ⚠️ Implicit session failed:', error);
            }
          }
        }
        
        console.log('[AuthBootstrap] ℹ️ No auth tokens in URL');
      } catch (e) {
        console.warn("[AuthBootstrap] ❌ Bootstrap failed:", e);
      }
    };

    bootstrapAuthFromUrl();

    return () => {
      cancelled = true;
    };
  }, []); // ✅ Empty array = runs ONCE on mount

  // === AUTH STATE LISTENER (RUNS ONCE — NEVER RE-SUBSCRIBE) ===
  useEffect(() => {
    // Note: initWebVitals() is called once in main.tsx - DO NOT add here
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // ✅ BEST PRACTICE (Supabase docs): Sessions are indefinite by default.
      // Refresh tokens never expire. NEVER sign out automatically unless
      // the server definitively revokes the session (403 + specific error codes).
      // Transient network failures, expired access tokens, and slow refreshes
      // are all recoverable — the SDK handles them automatically.

      if (event === 'TOKEN_REFRESHED') {
        // Token refreshed — session is still alive. Nothing to do.
        // Do NOT re-resolve authority or change any state here.
        if (!session) {
          console.warn('[App] ⚠️ Token refresh returned no session — SDK will retry automatically');
        }
        return;
      }
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('staff_routed_once');
        localStorage.removeItem('staff_authority_persistent_v3');
        localStorage.removeItem('cached_staff_role');
        localStorage.removeItem('cached_staff_scope');
        return;
      }

      if (session?.user) {
        // 🛡️ Guard: if AuthFormCard / AuthStartModal already initiated a
        // welcome-driven SPA navigation for THIS sign-in, skip the legacy
        // redirect block entirely. Prevents double-navigation + the white
        // flash that came from window.location.href below.
        const skipDueToWelcome = welcomeAlreadyRouted();

        // ✅ Institution account redirect (after email confirmation or returning)
        const accountType = session.user.user_metadata?.account_type;
        const isOnUniversityPage = window.location.pathname.startsWith('/university/');
        if (!skipDueToWelcome && accountType === 'institution' && !window.location.pathname.startsWith('/institution') && !isOnUniversityPage) {
          // Don't redirect if already on an institution or university route
          const postAuthReturn = sessionStorage.getItem('post_auth_return_to');
          if (postAuthReturn?.startsWith('/institution') || postAuthReturn?.startsWith('/university/')) {
            sessionStorage.removeItem('post_auth_return_to');
            navigateRouter(postAuthReturn, { replace: true });
            return;
          }
          // Resolve and go to exact university page
          import('@/lib/resolveInstitutionLanding').then(({ resolveInstitutionLanding }) => {
            resolveInstitutionLanding().then((path) => {
              navigateRouter(path, { replace: true });
            });
          }).catch(() => {
            navigateRouter('/institution/onboarding', { replace: true });
          });
          return;
        }

        // ✅ Unified authority resolution for SIGNED_IN and INITIAL_SESSION
        // TOKEN_REFRESHED is handled above (early return — session is alive)
        const isSessionEvent = event === 'SIGNED_IN' || event === 'INITIAL_SESSION';
        
        if (isSessionEvent) {
          // ⚡ FAST PATH: Use persistent staff authority cache for instant redirect
          const PERSISTENT_KEY = 'staff_authority_persistent_v3';
          let persistedAuth: { role: string; accessScope: string | null } | null = null;
          try {
            const raw = localStorage.getItem(PERSISTENT_KEY);
            if (raw) persistedAuth = JSON.parse(raw);
          } catch {}
          
          if (!skipDueToWelcome && persistedAuth?.role && persistedAuth.accessScope !== 'crm_only') {
            const isOnGenericPage = window.location.pathname === '/' || window.location.pathname === '/languages' || window.location.pathname.startsWith('/languages/');
            if (isOnGenericPage && !window.location.pathname.startsWith('/staff') && !window.location.pathname.startsWith('/admin')) {
              const staffLandingMap: Record<string, string> = {
                // super_admin: NO auto-redirect — free to navigate anywhere
                teacher: '/staff/teacher',
                editor: '/staff/editor',
                content_staff: '/staff/content',
              };
              const fastPath = staffLandingMap[persistedAuth.role];
              if (fastPath) {
                console.log(`[App] ⚡ Fast-path staff redirect (persistent cache): role=${persistedAuth.role} → ${fastPath}`);
                sessionStorage.setItem('staff_routed_once', '1');
                navigateRouter(fastPath, { replace: true });
                return;
              }
            }
            // Staff is already on staff route or non-generic page, skip CRM call entirely
            if (window.location.pathname.startsWith('/staff') || window.location.pathname.startsWith('/admin')) {
              console.log(`[App] ⚡ Staff authority from persistent cache — skipping CRM call`);
              setShowActivationGate(false);
              return;
            }
          }

          (async () => {
            const userEmail = session.user.email || '';
            const isFakeEmail = userEmail.endsWith('@phone.auth.portal');
            let isInstitution = session.user.user_metadata?.account_type === 'institution';

            // Also check if user is an active university page staff member
            // (institution accounts may not always have account_type metadata)
            if (!isInstitution) {
              try {
                const { data: staffRecord } = await supabase
                  .from('university_page_staff')
                  .select('id')
                  .eq('user_id', session.user.id)
                  .eq('status', 'active')
                  .limit(1)
                  .maybeSingle();
                if (staffRecord) {
                  isInstitution = true;
                  console.log('[App] 🏛️ User is active university page staff — treating as institution account');
                }
              } catch {
                // Non-blocking
              }
            }

            // Step 1: Check persistent cache first — only call CRM if no cache
            let authorityState: 'unknown' | 'portal_staff' | 'not_portal_staff' = 'unknown';
            let staffRole: string | null = null;
            let staffScope: string | null = null;

            // If persistent cache exists, use it (no CRM call needed)
            if (persistedAuth?.role) {
              staffRole = persistedAuth.role;
              staffScope = persistedAuth.accessScope;
              if (staffScope === 'crm_only') {
                authorityState = 'not_portal_staff';
              } else {
                authorityState = 'portal_staff';
                console.log(`[App] ⚡ Using persistent authority (no CRM call): role=${staffRole} scope=${staffScope}`);
              }
            } else {
              // First-time: call CRM to verify teacher eligibility
              try {
                const { data: staffResult } = await supabase.functions.invoke('student-portal-api', {
                  body: { action: 'resolve_staff_authority' },
                });
                if (staffResult?.data?.is_staff && staffResult?.data?.role) {
                  staffRole = staffResult.data.role;
                  staffScope = staffResult.data.access_scope;
                  if (staffScope === 'crm_only') {
                    console.log(`[App] ⛔ Staff has crm_only scope — treated as non-portal-staff. role=${staffRole} event=${event}`);
                    authorityState = 'not_portal_staff';
                  } else {
                    authorityState = 'portal_staff';
                    console.log(`[App] ✅ First-time CRM verification: portal_staff role=${staffRole} scope=${staffScope}`);
                  }
                } else {
                  authorityState = 'not_portal_staff';
                  console.log(`[App] ℹ️ Authority resolved: not_portal_staff event=${event}`);
                }
              } catch (err) {
                console.warn(`[App] Staff authority check failed (non-blocking, event=${event}):`, err);
                authorityState = 'not_portal_staff';
              }
            }



            // Step 2: Staff redirect — on SIGNED_IN or INITIAL_SESSION (if on generic page)
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && authorityState === 'portal_staff' && staffRole) {
              const alreadyRouted = sessionStorage.getItem('staff_routed_once') || welcomeAlreadyRouted();
              if (!alreadyRouted && !window.location.pathname.startsWith('/staff') && !window.location.pathname.startsWith('/admin')) {
                sessionStorage.setItem('staff_routed_once', '1');
                const staffLandingMap: Record<string, string> = {
                  // super_admin: NO auto-redirect — free to navigate anywhere
                  teacher: '/staff/teacher',
                  editor: '/staff/editor',
                  content_staff: '/staff/content',
                };
                const landingPath = staffLandingMap[staffRole];
                if (landingPath) {
                  console.log(`[App] ✅ Staff auto-routing: role=${staffRole} scope=${staffScope} → ${landingPath}`);
                  navigateRouter(landingPath, { replace: true });
                  return;
                }
              }
            }

            // Step 3: Skip activation gate for portal staff OR institution accounts
            if (authorityState === 'portal_staff' || isInstitution) {
              console.log(`[App] 🛡️ Skipping activation gate — staff=${authorityState === 'portal_staff'} institution=${isInstitution} (event=${event})`);
              setShowActivationGate(false);
              return;
            }

            // Step 4: Student activation gate check on session events.
            // - SIGNED_IN: can show gate if conclusively not linked.
            // - INITIAL_SESSION: never opens gate, but can close stale open state.
            if (isSessionEvent && !isFakeEmail && !isInstitution) {
              try {
                const { data: linkData, error: linkError } = await supabase.functions.invoke('student-portal-api', {
                  body: { action: 'check_link_status' },
                });

                if (linkError) {
                  console.warn('[App] ⚠️ Activation check failed (non-blocking):', linkError);
                  return;
                }

                if (linkData?.linked === true) {
                  console.log('[App] ✅ Student already linked — skipping activation gate');
                  setShowActivationGate(false);
                  return;
                }

                if (linkData?.linked === false && linkData?.error_code === 'no_linked_customer') {
                  // Safety fallback: portal_customer_map is the operational source of truth.
                  // If CRM view is temporarily stale but local linkage exists, do NOT show gate.
                  try {
                    const { data: mapping, error: mappingError } = await supabase
                      .from('portal_customer_map')
                      .select('crm_customer_id')
                      .eq('portal_auth_user_id', session.user.id)
                      .maybeSingle();

                    if (mapping?.crm_customer_id) {
                      console.log('[App] ✅ Local linkage exists in portal_customer_map — skipping activation gate');
                      setShowActivationGate(false);
                      return;
                    }

                    if (mappingError) {
                      console.warn('[App] ⚠️ portal_customer_map fallback check failed:', mappingError);
                    }
                  } catch (mappingErr) {
                    console.warn('[App] ⚠️ portal_customer_map fallback check threw:', mappingErr);
                  }

                  if (event === 'SIGNED_IN') {
                    console.log('[App] 🔔 Social/email student needs activation, showing gate');
                    setShowActivationGate(true);
                  } else {
                    console.log('[App] ℹ️ INITIAL_SESSION with no_linked_customer — keeping gate closed');
                    setShowActivationGate(false);
                  }
                  return;
                }

                console.warn('[App] ⚠️ Activation check inconclusive, keeping gate hidden:', {
                  linked: linkData?.linked,
                  error_code: linkData?.error_code,
                });
              } catch (err) {
                console.warn('[App] ⚠️ Activation check failed (non-blocking):', err);
              }
            }
          })();
        }

        migrateGuestShortlistOnLogin();
        
        // ✅ Return-To Lock: Check for post_auth_return_to and navigate
        const postAuthReturn = sessionStorage.getItem('post_auth_return_to');
        if (postAuthReturn) {
          console.log('[App] 🔄 Found post_auth_return_to:', postAuthReturn);
          sessionStorage.removeItem('post_auth_return_to');
          if (window.location.pathname !== postAuthReturn) {
            console.log('[App] ✅ Navigating to:', postAuthReturn);
            navigateRouter(postAuthReturn, { replace: true });
          }
        }
      }
    });

    // ✅ Passive session health check — NEVER signs out on transient errors.
    // Only signs out when the server definitively says "session revoked" (403).
    // 15s grace period gives the SDK plenty of time to auto-refresh on reload.
    const staleCheckTimer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          // No session in storage at all — user was never logged in or cleared manually
          console.log('[App] ℹ️ No session found after grace period');
          return;
        }

        // Verify with the auth server — but only act on DEFINITIVE revocations
        supabase.auth.getUser().then(({ error }) => {
          if (error) {
            const msg = error.message || '';
            const status = (error as any)?.status;
            
            // ONLY sign out on definitive server-side revocation:
            // - 403 with specific claim errors = session was revoked/invalidated server-side
            // - "missing sub claim" = token is structurally invalid (not recoverable)
            const isServerRevoked = 
              status === 403 && (msg.includes('missing sub') || msg.includes('invalid claim'));
            
            if (isServerRevoked) {
              console.warn('[App] 🚫 Session revoked by server, signing out:', msg);
              supabase.auth.signOut().catch(() => {});
            } else {
              // ALL other errors (network, 401 expired, timeouts, etc.) are transient.
              // The SDK will handle refresh automatically. Do NOT sign out.
              console.log('[App] ℹ️ getUser() error (transient, keeping session):', msg);
            }
          } else {
            console.log('[App] ✅ Session verified with server');
          }
        });
      });
    }, 15000); // 15s grace period — SDK auto-refresh completes well within this
    
    return () => {
      subscription.unsubscribe();
      clearTimeout(staleCheckTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ CRITICAL: Run ONCE on mount — NEVER re-subscribe on route change

  // 🆕 Auth modal from URL param (separate effect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authParam = urlParams.get('auth');
    
    if (authParam === '1' && pathname === '/') {
      urlParams.delete('auth');
      const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams.toString()}` 
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      setTimeout(() => { navigateRouter('/auth'); }, 100);
    }
  }, [pathname]);

  return (
    <>
      <ScrollToTop />
      <RoutePrefetcher />
      {/* Route-level welcome transition — survives client-side navigation */}
      <WelcomeTransition />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Sync Routes (Critical) */}
          <Route path="/" element={<Index />} />
          {/* Dedicated Auth Page */}
          <Route path="/auth" element={<AuthPageLazy />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invite" element={<AcceptInviteLazy />} />
          
          {/* Public Routes (Lazy) */}
          {/* ✅ Canonical Search: /universities is the official route */}
          <Route path="/universities" element={<Universities />} />
          {/* Countries page - all study destinations */}
          <Route path="/countries" element={<Countries />} />
          {/* Legacy /search redirects to canonical with smart param mapping */}
          <Route path="/search" element={<SearchRedirect />} />
          <Route path="/university/:id" element={<UniversityDetails />} />
          <Route path="/program/:id" element={<ProgramDetails />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/portal" element={<StudentPortal />} />
          <Route path="/portal/dashboard" element={<Navigate to="/account" replace />} />
          <Route path="/apply-now" element={<ApplyPage />} />
          <Route path="/status/:id" element={<Status />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/privacy-policy/teacher" element={<TeacherPrivacyPolicy />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/account" element={<Account />} />
          <Route path="/account/applications" element={<AccountApplications />} />
          <Route path="/account/favorites" element={<AccountFavorites />} />
          <Route path="/p/:id" element={<ProgramDetails />} />
          <Route path="/country/:slug" element={<Country />} />
          <Route path="/study-in/:countrySlug" element={<LegacyStudyInRedirect />} />
          <Route path="/services/:slug" element={<ServiceDetails />} />
          <Route path="/portal/:token" element={<PortalToken />} />
          <Route path="/student-portal" element={<StudentPortal />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/compare-universities" element={<CompareUniversities />} />
          <Route path="/scholarships" element={<Scholarships />} />
          <Route path="/explore-map" element={<ExploreMap />} />
          <Route path="/paid-services" element={<PaidServices />} />
          <Route path="/about-oryxa" element={<AboutOryxa />} />

          {/* Locale-prefixed public routes (additive, SEO-safe) */}
          <Route path=":locale">
            <Route path="" element={<LocaleRouteWrapper><Index /></LocaleRouteWrapper>} />
            <Route path="universities" element={<LocaleRouteWrapper><Universities /></LocaleRouteWrapper>} />
            <Route path="countries" element={<LocaleRouteWrapper><Countries /></LocaleRouteWrapper>} />
            <Route path="search" element={<LocaleRouteWrapper><SearchRedirect /></LocaleRouteWrapper>} />
            <Route path="university/:id" element={<LocaleRouteWrapper><UniversityDetails /></LocaleRouteWrapper>} />
            <Route path="program/:id" element={<LocaleRouteWrapper><ProgramDetails /></LocaleRouteWrapper>} />
            <Route path="p/:id" element={<LocaleRouteWrapper><ProgramDetails /></LocaleRouteWrapper>} />
            <Route path="country/:slug" element={<LocaleRouteWrapper><Country /></LocaleRouteWrapper>} />
            <Route path="study-in/:countrySlug" element={<LegacyStudyInRedirect />} />
            <Route path="about" element={<LocaleRouteWrapper><About /></LocaleRouteWrapper>} />
            <Route path="team" element={<LocaleRouteWrapper><Team /></LocaleRouteWrapper>} />
            <Route path="partners" element={<LocaleRouteWrapper><Partners /></LocaleRouteWrapper>} />
            <Route path="ielts" element={<LocaleRouteWrapper><IELTSPage /></LocaleRouteWrapper>} />
            <Route path="languages" element={<LocaleRouteWrapper><LanguagesLanding /></LocaleRouteWrapper>} />
            <Route path="languages/teacher/:teacherId" element={<LocaleRouteWrapper><TeacherProfilePage /></LocaleRouteWrapper>} />
            <Route path="languages/:languageKey" element={<LocaleRouteWrapper><LanguageCourseComingSoon /></LocaleRouteWrapper>} />
            <Route path="languages/russian" element={<LocaleRouteWrapper><RussianLanding /></LocaleRouteWrapper>} />
            <Route path="languages/russian/onboarding" element={<LocaleRouteWrapper><RussianOnboarding /></LocaleRouteWrapper>} />
            <Route path="languages/russian/plan" element={<LocaleRouteWrapper><RussianPlan /></LocaleRouteWrapper>} />
            <Route path="languages/russian/dashboard" element={<LocaleRouteWrapper><RussianDashboard /></LocaleRouteWrapper>} />
            <Route path="languages/russian/placement-auth" element={<LocaleRouteWrapper><PlacementAuth /></LocaleRouteWrapper>} />
            <Route path="languages/russian/placement-test" element={<LocaleRouteWrapper><PlacementTest /></LocaleRouteWrapper>} />
            <Route path="my-learning" element={<LocaleRouteWrapper><MyLearning /></LocaleRouteWrapper>} />
            <Route path="languages/russian/modules/:moduleSlug" element={<LocaleRouteWrapper><RussianModule /></LocaleRouteWrapper>} />
            <Route path="languages/russian/lessons/:lessonSlug" element={<LocaleRouteWrapper><RussianLesson /></LocaleRouteWrapper>} />
            <Route path="languages/russian/checkpoints/:templateKey" element={<LocaleRouteWrapper><RussianCheckpoint /></LocaleRouteWrapper>} />
            <Route path="languages/russian/exams/:examSetKey" element={<LocaleRouteWrapper><RussianExam /></LocaleRouteWrapper>} />
            <Route path="courses" element={<LocaleRouteWrapper><CoursesPage /></LocaleRouteWrapper>} />
            <Route path="blog" element={<LocaleRouteWrapper><BlogPage /></LocaleRouteWrapper>} />
            <Route path="faq" element={<LocaleRouteWrapper><FAQPage /></LocaleRouteWrapper>} />
            <Route path="contact" element={<LocaleRouteWrapper><Contact /></LocaleRouteWrapper>} />
            <Route path="scholarships" element={<LocaleRouteWrapper><Scholarships /></LocaleRouteWrapper>} />
          </Route>
          
          {/* Footer Pages */}
          <Route path="/about" element={<About />} />
          <Route path="/team" element={<Team />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/ielts" element={<IELTSPage />} />
          <Route path="/languages" element={<LanguagesLanding />} />
            <Route path="/languages/teacher/:teacherId" element={<TeacherProfilePage />} />
          <Route path="/languages/:languageKey" element={<LanguageCourseComingSoon />} />
          <Route path="/languages/russian" element={<RussianLanding />} />
          <Route path="/languages/russian/onboarding" element={<RussianOnboarding />} />
          <Route path="/languages/russian/plan" element={<RussianPlan />} />
          <Route path="/languages/russian/dashboard" element={<RussianDashboard />} />
          <Route path="/languages/russian/placement-auth" element={<PlacementAuth />} />
          <Route path="/languages/russian/placement-test" element={<PlacementTest />} />
          <Route path="/my-learning" element={<MyLearning />} />
          <Route path="/languages/russian/modules/:moduleSlug" element={<RussianModule />} />
          <Route path="/languages/russian/lessons/:lessonSlug" element={<RussianLesson />} />
          <Route path="/languages/russian/checkpoints/:templateKey" element={<RussianCheckpoint />} />
          <Route path="/languages/russian/exams/:examSetKey" element={<RussianExam />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/for-institutions" element={<ForInstitutionsPage />} />
          <Route path="/where-we-are" element={<WhereWeArePage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/me" element={<CommunityProfilePage />} />
          <Route path="/community/u/:userId" element={<CommunityProfilePage />} />
          <Route path="/events" element={<EventsPage />} />
          
          {/* ORX RANK Routes */}
          <Route path="/orx-rank" element={<OrxRankHub />} />
          <Route path="/orx-rank/methodology" element={<OrxMethodology />} />
          <Route path="/orx-rank/articles" element={<OrxArticles />} />
          <Route path="/orx-rank/articles/:slug" element={<OrxArticleDetail />} />
          <Route path="/orx-rank/countries" element={<OrxCountries />} />
          
          {/* Translation Service Routes */}
          <Route path="/app/translation/new" element={<TranslationNewOrder />} />
          <Route path="/app/translation/orders/:orderId" element={<TranslationOrderDetails />} />
          
          {/* Admin Routes (Lazy) */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DecisionDashboard />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="analytics-reports" element={<AnalyticsReports />} />
            <Route path="telemetry" element={<Telemetry />} />
            <Route path="integrations" element={<AdminIntegrationsMonitor />} />
            <Route path="universities" element={<UniversitiesAdmin />} />
            <Route path="institutions" element={<InstitutionsAdmin />} />
            <Route path="institutions/:id" element={<AdminInstitutionView />}>
              <Route index element={<InstitutionOverview />} />
              <Route path="applications" element={<InstitutionApplications />} />
              <Route path="applications/:appId" element={<InstitutionApplicationDetail />} />
              <Route path="page" element={<InstitutionPageEditor />} />
              <Route path="programs" element={<InstitutionPrograms />} />
              <Route path="team" element={<InstitutionTeam />} />
              <Route path="documents" element={<InstitutionDocuments />} />
              <Route path="analytics" element={<InstitutionAnalytics />} />
              <Route path="settings" element={<InstitutionSettings />} />
            </Route>
            <Route path="page-edits" element={<AdminPageEditsReview />} />
            <Route path="universities-admin" element={<UniversitiesAdmin />} />
            <Route path="programs" element={<AdminPrograms />} />
            <Route path="programs-admin" element={<ProgramsAdmin />} />
            <Route path="scholarships-admin" element={<ScholarshipsAdmin />} />
            <Route path="events-admin" element={<EventsAdmin />} />
            <Route path="testimonials" element={<AdminTestimonials />} />
            <Route path="countries" element={<AdminCountries />} />
            <Route path="scholarships" element={<AdminScholarships />} />
            <Route path="import" element={<AdminImport />} />
            <Route path="applications-admin" element={<ApplicationsAdmin />} />
            <Route path="crm-board" element={<CRMBoard />} />
            <Route path="integration-logs" element={<AdminIntegrationLogs />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="feature-settings" element={<FeatureSettingsAdmin />} />
            <Route path="feature-flags" element={<FeatureFlags />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="health" element={<AdminHealth />} />
            <Route path="university/:id" element={<UniversityEdit />} />
            <Route path="ai-assistant" element={<AIAssistant />} />
            <Route path="import-programs" element={<ImportPrograms />} />
            <Route path="integrations/crm" element={<CRMKeys />} />
            <Route path="integrations/outbox" element={<Outbox />} />
            <Route path="tuition-monitor" element={<TuitionMonitor />} />
            <Route path="tuition-proposals" element={<TuitionProposals />} />
            <Route path="universities/:id/studio" element={<UniversityStudio />} />
            <Route path="university/new/studio" element={<UniversityStudioPage />} />
            <Route path="university/:id/studio" element={<UniversityStudioPage />} />
            <Route path="seo-ops" element={<SeoOps />} />
            <Route path="seo-ops/backlinks" element={<BacklinksPage />} />
            <Route path="seo-ops/gsc" element={<GSCPage />} />
            <Route path="seo-ops/experiments" element={<ExperimentsPage />} />
            <Route path="data-quality" element={<DataQualityDashboard />} />
            <Route path="budget" element={<BudgetDashboard />} />
            <Route path="feature-flags" element={<FeatureFlagsAdmin />} />
            <Route path="russian-universities-import" element={<RussianUniversitiesImport />} />
            <Route path="unis-assistant" element={<UnisAssistant />} />
            <Route path="import-structured-data" element={<ImportStructuredData />} />
            
            <Route path="generate-program-scholarship-images" element={<GenerateProgramScholarshipImages />} />
            <Route path="media-review" element={<MediaReview />} />
            <Route path="news-ticker" element={<NewsTickerSettings />} />
            <Route path="website-enrichment" element={<WebsiteEnrichment />} />
            <Route path="bulk-publish" element={<BulkPublish />} />
            <Route path="orx-control" element={<OrxControlPanel />} />
            <Route path="language-enrollments" element={<LanguageEnrollments />} />
            
          </Route>
          
          {/* Staff Routes (CRM authority-gated) */}
          <Route path="/staff/teacher/*" element={
            <Layout>
              <StaffGuard allowedRoles={['teacher']}>
                <StaffTeacherDashboard />
              </StaffGuard>
            </Layout>
          } />
          <Route path="/staff/editor" element={
            <StaffGuard allowedRoles={['editor']}>
              <StaffEditorLanding />
            </StaffGuard>
          } />
          <Route path="/staff/content" element={
            <StaffGuard allowedRoles={['content_staff']}>
              <StaffContentLanding />
            </StaffGuard>
          } />

          {/* Institution Routes */}
          <Route path="/institution/onboarding" element={
            <InstitutionGuard allowedStates={['no_institution_link', 'claim_draft']}>
              <InstitutionOnboarding />
            </InstitutionGuard>
          } />
          <Route path="/institution/search" element={
            <InstitutionGuard allowedStates={['no_institution_link', 'claim_draft']}>
              <InstitutionSearch />
            </InstitutionGuard>
          } />
          <Route path="/institution/claim" element={
            <InstitutionGuard allowedStates={['no_institution_link', 'claim_draft']}>
              <InstitutionClaim />
            </InstitutionGuard>
          } />
          <Route path="/institution/pending" element={
            <InstitutionGuard allowedStates={['claim_submitted', 'under_review', 'more_info_requested', 'rejected']}>
              <InstitutionPending />
            </InstitutionGuard>
          } />
          <Route path="/institution/locked" element={
            <InstitutionGuard allowedStates={['suspended']}>
              <InstitutionLocked />
            </InstitutionGuard>
          } />
          {/* Legacy institution dashboard — FROZEN, redirects to home */}
          <Route path="/institution/dashboard/*" element={<Navigate to="/" replace />} />
          
          {/* Tools */}
          <Route path="/tools/universities-no-website" element={<UniversitiesWithoutWebsitePdf />} />
          <Route path="/tools/universities-no-city" element={<ExportNoCityPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      
      {/* Unified Floating Launcher — Support + Oryxa AI merged */}
      <PortalAuthFloater />
      
      {/* CRM Test Mode Panel - Activated via ?testmode=1 */}
      <CrmTestPanel />
      
      {/* Institution Preview Picker for Super Admins */}
      <InstitutionPickerModal />
      
      {/* 🆕 Auth Start Modal - Shows on first visit */}
      <AuthStartModal open={showAuthModal} onOpenChange={(open) => open ? openAuthModal() : closeAuthModal()} />
      
      {/* 🆕 Phone Activation Gate - Forces social/email students to verify phone */}
      <PhoneActivationGate 
        open={showActivationGate} 
        onOpenChange={setShowActivationGate}
        onActivated={() => setShowActivationGate(false)}
      />
    </>
  );
}

const App = () => (
  <MalakChatProvider>
    <StudentTourProvider>
      <CurrencyProvider>
        <InstitutionPreviewProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider>
                <CanonicalRedirect />
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AppContent />
                  <StudentSiteTour />
                </BrowserRouter>
              </TooltipProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </InstitutionPreviewProvider>
      </CurrencyProvider>
    </StudentTourProvider>
  </MalakChatProvider>
);

export default App;
