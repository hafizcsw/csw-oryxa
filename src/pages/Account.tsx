import { useEffect, useState, lazy, Suspense, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { PORTAL_BASE_URL } from "@/config/urls";
import { syncShortlist } from "@/lib/portalApi";
import { trackAccountOpen, trackServiceStepOpen } from "@/lib/decisionTracking";

// Helper to convert storage path to public URL
const resolveAvatarUrl = (pathOrUrl?: string | null): string | undefined => {
  if (!pathOrUrl) return undefined;
  // If already a full URL, return as-is
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  // Convert storage path → public URL
  const { data } = supabase.storage.from('avatars').getPublicUrl(pathOrUrl);
  return data?.publicUrl;
};
import ProfileSkeleton from "@/components/portal/ProfileSkeleton";
import OfflineIndicator from "@/components/portal/OfflineIndicator";
import UpdateNotification from "@/components/portal/UpdateNotification";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentDocuments } from "@/hooks/useStudentDocuments";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { AccountSidebar } from "@/components/portal/account/AccountSidebar";
import { AccountContentHeader } from "@/components/portal/account/AccountContentHeader";
import { AccountMobileNav } from "@/components/portal/account/AccountMobileNav";
import { AccountTopBar } from "@/components/portal/account/AccountTopBar";

import { Footer } from "@/components/layout/Footer";
// Teacher-only tabs and large student tabs are lazy — most users never reach them on first paint.
const DashboardOverview = lazy(() => import("@/components/portal/account/DashboardOverview").then(m => ({ default: m.DashboardOverview })));
const TeacherAccountOverview = lazy(() => import("@/components/portal/account/TeacherAccountOverview").then(m => ({ default: m.TeacherAccountOverview })));
const TeacherVerificationTab = lazy(() => import("@/components/portal/account/TeacherVerificationTab").then(m => ({ default: m.TeacherVerificationTab })));
const TeacherDocumentsTab = lazy(() => import("@/components/portal/account/TeacherDocumentsTab").then(m => ({ default: m.TeacherDocumentsTab })));
import { FloatingStudentCTA } from "@/components/portal/FloatingStudentCTA";
import { useStaffAuthority } from "@/hooks/useStaffAuthority";
import { useTeacherPermissions } from "@/lib/teacherPermissions";
import { useTeacherProfile } from "@/hooks/useTeacherProfile";
import { useTeacherState } from "@/hooks/useTeacherState";
// JourneyStepsFixed moved to ApplicationStatusTab
import { calculateProfileProgress } from "@/utils/calculateProfileProgress";
import { useFileQuality } from "@/hooks/useFileQuality";
const StudentInbox = lazy(() => import("@/components/comm/StudentInbox").then(m => ({ default: m.StudentInbox })));
const StudyFileTab = lazy(() => import("@/components/portal/tabs/StudyFileTab").then(m => ({ default: m.StudyFileTab })));
// IdentityActivationDialog is mounted inside StudyFileTab (single canonical lock point).
import { useIdentityStatus } from "@/hooks/useIdentityStatus";

// Tab loaders for preloading
const loadProfileTab = () => import("@/components/portal/tabs/ProfileTab");
const loadApplicationsTab = () => import("@/components/portal/tabs/ApplicationsTab");
const loadDocumentsTab = () => import("@/components/portal/tabs/DocumentsTab");
const loadShortlistTab = () => import("@/components/portal/tabs/ShortlistTab");
const loadWalletTab = () => import("@/components/portal/tabs/WalletTab");
const loadVisaTab = () => import("@/components/portal/tabs/VisaTab");
const loadTimelineTab = () => import("@/components/portal/tabs/TimelineTab");
const loadSettingsTab = () => import("@/components/portal/tabs/SettingsTab");
const loadServicesTab = () => import("@/components/portal/tabs/ServicesTab");
const loadPaymentsTab = () => import("@/components/portal/tabs/PaymentsTab");
const loadCaseTab = () => import("@/components/portal/tabs/CaseStatusTab");
const loadReadinessTab = () => import("@/components/readiness/ReadinessTab");

// Lazy components using loaders
const ProfileTab = lazy(() => loadProfileTab().then(m => ({ default: m.ProfileTab })));
const ApplicationsTab = lazy(() => loadApplicationsTab().then(m => ({ default: m.ApplicationsTab })));
const DocumentsTab = lazy(() => loadDocumentsTab().then(m => ({ default: m.DocumentsTab })));
const ShortlistTab = lazy(() => loadShortlistTab().then(m => ({ default: m.ShortlistTab })));
const WalletTab = lazy(() => loadWalletTab().then(m => ({ default: m.WalletTab })));
const VisaTab = lazy(() => loadVisaTab().then(m => ({ default: m.VisaTab })));
const TimelineTab = lazy(() => loadTimelineTab().then(m => ({ default: m.TimelineTab })));
const SettingsTab = lazy(() => loadSettingsTab().then(m => ({ default: m.SettingsTab })));
const ServicesTab = lazy(() => loadServicesTab().then(m => ({ default: m.ServicesTab })));
const PaymentsTab = lazy(() => loadPaymentsTab().then(m => ({ default: m.PaymentsTab })));
const CaseStatusTab = lazy(() => loadCaseTab().then(m => ({ default: m.CaseStatusTab })));
const ReadinessTab = lazy(() => loadReadinessTab().then(m => ({ default: m.ReadinessTab })));

// Tab loaders map for hover preload
const tabLoaders: Record<string, () => Promise<any>> = {
  'study-file': loadProfileTab,
  profile: loadProfileTab,
  documents: loadDocumentsTab,
  shortlist: loadShortlistTab,
  applications: loadApplicationsTab,
  services: loadServicesTab,
  visa: loadVisaTab,
  wallet: loadWalletTab,
  settings: loadSettingsTab,
  timeline: loadTimelineTab,
  payments: loadPaymentsTab,
  'case': loadCaseTab,
  readiness: loadReadinessTab,
};

export default function AccountPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { studentPortalToken, fullLogout, setAuthenticatedSession, shortlist: localShortlist } = useMalakChat();

  const { profile, crmProfile, loading: crmLoading, error: profileError, refetch: refetchCrm, updateProfile: updateCrmProfile } = useStudentProfile();
  // ✅ Gate secondary CRM calls until profile loads to avoid overwhelming edge functions
  const profileReady = !crmLoading && !!crmProfile;
  const { documents: studentDocs } = useStudentDocuments({ enabled: profileReady });
  const fileQuality = useFileQuality(crmProfile, studentDocs);
  const staffAuth = useStaffAuthority();
  const { isStaff, role, teacherTruth } = staffAuth;
  const isTeacher = isStaff && role === 'teacher';
  const permissions = useTeacherPermissions(role);
  
  // ✅ Local-first teacher state (reads Portal cache, syncs from CRM only if missing/stale)
  const teacherState = useTeacherState(permissions.isTeacherCapable);
  // Legacy hook kept for documents only (documents are in Portal DB, not CRM-synced state)
  const teacherProfileFromHook = useTeacherProfile(permissions.isTeacherCapable);
  
  // Build unified teacher profile: prefer local synced state, fall back to hook
  const teacherProfile = (teacherState.found && isTeacher) ? {
    ...teacherProfileFromHook,
    canTeach: teacherState.canTeach,
    approvalStatus: teacherState.approvalStatus,
    identityVerified: teacherState.identityVerified,
    educationVerified: teacherState.educationVerified,
    blockers: teacherState.blockers,
    reviewerNotes: teacherState.reviewerNotes,
    rejectionReason: teacherState.rejectionReason,
    moreInfoReason: teacherState.moreInfoReason,
    fullName: teacherState.fullName || teacherProfileFromHook.fullName,
    phone: teacherState.phone || teacherProfileFromHook.phone,
    found: true,
    resolved: true,
  } : teacherProfileFromHook;

  // ✅ Session-first auth: Supabase Session is source of truth
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isRelinking, setIsRelinking] = useState(false);
  const tokenVerificationAttempted = useRef(false);
  const tokenExchangeInProgress = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const programIdFromUrl = searchParams.get('program_id');
  
  // ✅ URL = Source of Truth for activeTab
  const VALID_TABS = new Set(['overview', 'study-file', 'profile', 'readiness', 'documents', 'payments', 'shortlist', 'services', 'applications', 'case', 'wallet', 'settings', 'timeline', 'teacher-verification', 'teacher-documents', 'messages']);
  const TAB_ORDER = ['overview', 'study-file', 'shortlist', 'services', 'applications', 'payments', 'case', 'wallet', 'settings'];
  const urlTab = searchParams.get('tab') || 'overview';
  const activeTab = VALID_TABS.has(urlTab) ? urlTab : 'overview';
  
  // Identity status no longer read here — the gate lives inside StudyFileTab.


  const setActiveTab = useCallback((tab: string) => {
    // ✅ Decision tracking: service step opened
    if (tab === 'services') trackServiceStepOpen('services_tab');
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', tab);
      // Clean up irrelevant params when switching tabs
      if (tab !== 'payments') p.delete('payment_id');
      if (tab !== 'documents') p.delete('application_id');
      if (tab !== 'services') p.delete('draft_id');
      return p;
    }, { replace: true });
  }, [setSearchParams]);

  // Scroll ref for content area
  const scrollRef = useRef<HTMLDivElement>(null);

  const { t } = useLanguage();
  
  // Set page title based on language
  useEffect(() => {
    document.title = t('portal.pageTitle');
  }, [language, t]);

  const handleStartProgram = useCallback((programId: string, countryCode?: string) => {
    console.log('[Account] 🚀 handleStartProgram called:', { programId, countryCode });
    // IMPORTANT: single atomic URL update to avoid losing program_id due to back-to-back setSearchParams calls
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', 'services');
      p.set('program_id', programId);
      if (countryCode) p.set('country', countryCode);

      // Clean up irrelevant params
      p.delete('payment_id');
      p.delete('application_id');
      p.delete('draft_id');

      console.log('[Account] 🚀 URL params set:', p.toString());
      return p;
    }, { replace: true });
  }, [setSearchParams]);

  // Handler for clearing program selection and going back to favorites
  const handleClearProgramAndGoToFavorites = useCallback(() => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.delete("program_id");
      p.delete("country");
      return p;
    });
    setActiveTab("shortlist");
  }, [setSearchParams]);

  // ✅ P0.1 Fix: Reactive isAuthCallback using useLocation (not static useMemo)
  const location = useLocation();
  const isAuthCallback = 
    location.hash.includes('access_token=') ||
    new URLSearchParams(location.search).has('code') ||
    new URLSearchParams(location.search).has('type');

  // ✅ PRIMARY: Check Supabase session FIRST (Source of Truth)
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      setSessionReady(true);
      
      if (session) {
        // ✅ Decision tracking: account opened
        trackAccountOpen();
        // ✅ P0 Fix: Clear token when session exists (session is source of truth)
        localStorage.removeItem('student_portal_token');
        tokenVerificationAttempted.current = false;
        
        // ✅ P0.1 Fix: Clean auth callback params from URL
        if (window.location.hash.includes('access_token=') || 
            new URLSearchParams(window.location.search).has('code') ||
            new URLSearchParams(window.location.search).has('type')) {
          const currentTab = new URLSearchParams(window.location.search).get('tab');
          const cleanUrl = currentTab ? `/account?tab=${currentTab}` : '/account';
          window.history.replaceState({}, document.title, cleanUrl);
        }
        
        try { await supabase.rpc('rpc_link_my_auth'); } catch {}
        await refetchCrm();
      }
      setLoading(false);
    };
    
    initSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      if (session) {
        // ✅ P0 Fix: Clear token on auth state change too
        localStorage.removeItem('student_portal_token');
        refetchCrm();
      }
      setLoading(false);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // ✅ P0.2: Auth Pending Flag helper
  const isAuthPending = useCallback(() => {
    const pendingUntil = sessionStorage.getItem('portal_auth_pending_until');
    if (!pendingUntil) return false;
    return Date.now() < parseInt(pendingUntil, 10);
  }, []);
  
  const clearAuthPending = useCallback(() => {
    sessionStorage.removeItem('portal_auth_pending_until');
    sessionStorage.removeItem('portal_auth_pending_reason');
    sessionStorage.removeItem('portal_exchange_token'); // ✅ P0.2 Final: Clear recovery token too
  }, []);

  // ✅ P0.2: Session polling during auth pending
  useEffect(() => {
    if (!isAuthPending() || hasSession) return;
    
    console.log('[Account] 🔄 Auth pending detected, starting session polling...');
    let pollCount = 0;
    const maxPolls = 12; // 12 polls × 500ms = 6 seconds
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('[Account] ✅ Session found via polling!');
        clearAuthPending();
        localStorage.removeItem('student_portal_token');
        setHasSession(true);
        clearInterval(pollInterval);
        return;
      }
      
      if (pollCount >= maxPolls || !isAuthPending()) {
        console.log('[Account] ⏰ Polling timeout, clearing pending flag');
        clearAuthPending();
        clearInterval(pollInterval);
      }
    }, 500);
    
    return () => clearInterval(pollInterval);
  }, [isAuthPending, hasSession, clearAuthPending]);

  // ✅ SECONDARY: Token exchange (only if no session AND token exists)
  useEffect(() => {
    const exchangeTokenForSession = async () => {
      // ✅ P0.2 Final: Get token from localStorage OR sessionStorage (recovery path)
      const localToken = studentPortalToken;
      const recoveryToken = sessionStorage.getItem('portal_exchange_token');
      const tokenToUse = localToken || recoveryToken;
      
      // Skip if: session exists, already exchanging, no token, or already attempted
      if (hasSession || tokenExchangeInProgress.current || !tokenToUse || tokenVerificationAttempted.current || !sessionReady) {
        return;
      }
      
      tokenExchangeInProgress.current = true;
      tokenVerificationAttempted.current = true;
      setIsVerifyingToken(true);
      
      const isRecoveryAttempt = !localToken && !!recoveryToken;
      console.log(`[Account] 🔄 Exchanging token for session... (recovery: ${isRecoveryAttempt})`);
      
      try {
        const { data, error } = await supabase.functions.invoke('portal-verify', {
          body: { 
            token: tokenToUse,
            return_to: '/account',
            portal_origin: PORTAL_BASE_URL  // ✅ Always use canonical domain
          }
        });
        
        if (data?.ok && data?.action_link) {
          // ✅ Debug: Log action_link for troubleshooting redirect issues
          console.log('[Account] 🔗 action_link full value:', data.action_link);
          try {
            const linkUrl = new URL(data.action_link);
            console.log('[Account] 🔗 action_link parsed:', {
              origin: linkUrl.origin,
              path: linkUrl.pathname,
              hash: linkUrl.hash?.slice(0, 50) + (linkUrl.hash?.length > 50 ? '...' : '')
            });
          } catch (e) {
            console.warn('[Account] ⚠️ Could not parse action_link as URL');
          }
          
          // ✅ P0.2: Set auth pending flag BEFORE redirect (12 seconds window)
          sessionStorage.setItem('portal_auth_pending_until', String(Date.now() + 12000));
          sessionStorage.setItem('portal_auth_pending_reason', 'token_exchange');
          
          // ✅ Return-To Lock: Store intended destination for guaranteed navigation after session
          sessionStorage.setItem('post_auth_return_to', '/account');
          
          // ✅ P0.2 Final: Save token to sessionStorage for recovery path before removing
          sessionStorage.setItem('portal_exchange_token', tokenToUse);
          
          // ✅ P0.1 Fix: Clear token from localStorage BEFORE redirect to prevent re-run on refresh
          localStorage.removeItem('student_portal_token');
          console.log('[Account] ✅ Token valid, redirecting to action_link');
          window.location.href = data.action_link;
        } else if (data?.ok && !data?.action_link) {
          // ✅ Safety: ok=true but no action_link (should not happen, but handle gracefully)
          console.warn('[Account] ⚠️ portal-verify returned ok=true but no action_link');
          toast({
            title: t('portal.toast.couldNotCreateLink'),
            description: t('portal.toast.tryAgain'),
            variant: 'destructive',
          });
          tokenVerificationAttempted.current = false; // Allow retry
          localStorage.removeItem('student_portal_token');
          sessionStorage.removeItem('portal_exchange_token');
        } else {
          // ✅ P0.2 Final: Unify parsing - treat data.status same as data.reason
          const reason = data?.reason || data?.status || 'unknown';
          console.log('[Account] ⏳ Token invalid, reason:', reason);
          
          // For token_used or token_used_retry_ok, poll session first
          if (reason === 'token_used' || reason === 'token_used_retry_ok') {
            console.log('[Account] 🔄 Token used, polling session for 5s...');
            let sessionFound = false;
            
            for (let i = 0; i < 10; i++) {
              await new Promise(r => setTimeout(r, 500));
              const { data: { session: pollSession } } = await supabase.auth.getSession();
              if (pollSession) {
                console.log('[Account] ✅ Session found after token_used polling!');
                localStorage.removeItem('student_portal_token');
                sessionStorage.removeItem('portal_exchange_token');
                setHasSession(true);
                sessionFound = true;
                break;
              }
            }
            
            if (sessionFound) return;
          }
          
          // Standard re-check after 800ms
          await new Promise(r => setTimeout(r, 800));
          
          const { data: { session: recheck } } = await supabase.auth.getSession();
          if (recheck) {
            console.log('[Account] ✅ Session found on re-check, ignoring token error');
            localStorage.removeItem('student_portal_token');
            sessionStorage.removeItem('portal_exchange_token');
            setHasSession(true);
            return;
          }
          
          // ✅ P0.2 Final: NEVER show token_expired toast while auth pending
          if (isAuthPending()) {
            console.log('[Account] ⏳ Auth still pending, waiting...');
            return; // Don't show error yet, let polling continue
          }
          
          // ✅ Final check: One more getSession before showing error
          const { data: { session: finalCheck } } = await supabase.auth.getSession();
          if (finalCheck) {
            console.log('[Account] ✅ Session found on final check!');
            localStorage.removeItem('student_portal_token');
            sessionStorage.removeItem('portal_exchange_token');
            setHasSession(true);
            return;
          }
          
          // ❌ Only show error if reason is token_expired AND pending fully expired AND no session
          console.log('[Account] ❌ No session after all checks, reason:', reason);
          localStorage.removeItem('student_portal_token');
          sessionStorage.removeItem('portal_exchange_token');
          
          if (reason === 'token_expired') {
            toast({
              title: t('portal.toast.linkExpired'),
              description: t('portal.toast.pleaseLoginAgain'),
              variant: 'destructive',
            });
          }
        }
      } catch (err) {
        console.error('[Account] Token exchange error:', err);
        if (!isAuthPending()) {
          toast({
            title: t('portal.toast.connectionError'),
            description: t('portal.toast.serverConnectionFailed'),
            variant: 'destructive',
          });
        }
      } finally {
        setIsVerifyingToken(false);
        tokenExchangeInProgress.current = false;
      }
    };
    
    exchangeTokenForSession();
  }, [sessionReady, hasSession, studentPortalToken, toast, isAuthPending]);

  useEffect(() => {
    if (!crmLoading) setLoading(false);
  }, [crmLoading]);

  // Preload tabs in background after page loads
  useEffect(() => {
    const preloadTabs = () => {
      // Most used tabs first
      loadProfileTab();
      loadDocumentsTab();
      loadShortlistTab();
      
      // Rest after 300ms
      setTimeout(() => {
        loadApplicationsTab();
        loadServicesTab();
        loadVisaTab();
        loadWalletTab();
        loadSettingsTab();
        loadTimelineTab();
        loadPaymentsTab();
      }, 300);
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(preloadTabs, { timeout: 2000 });
    } else {
      setTimeout(preloadTabs, 500);
    }
  }, []);

  // Handler for hover preload
  const handleTabHover = useCallback((tabName: string) => {
    const loader = tabLoaders[tabName];
    if (loader) loader();
  }, []);
  // ✅ OLD Email/Password login REMOVED - OTP only via AuthModal

  // 🔗 Handle re-linking for users with old sessions (SMART VERSION)
  const handleRelink = async () => {
    setIsRelinking(true);
    
    try {
      // 🆕 Step 1: Check if already linked via student-portal-api (no token needed)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        console.log('[Account] 🔎 Checking link status via session first...');
        
        const checkRes = await supabase.functions.invoke('student-portal-api', {
          body: { action: 'check_link_status' }
        });
        
        console.log('[Account] 🔎 check_link_status result:', checkRes.data);
        
        if (checkRes.data?.ok && checkRes.data?.linked === true) {
          // ✅ مربوط حسب check_link_status، نتأكد من get_profile مباشرة (لا نعتمد على state)
          const { data: profileData } = await supabase.functions.invoke('student-portal-api', {
            body: { action: 'get_profile' },
          });
          
          const inner = profileData?.data;
          const confirmed = profileData?.ok === true && inner && !inner.error && (inner.id || inner.auth_user_id || inner.customer_id);

          if (confirmed) {
            toast({ 
              title: t('portal.relink.accountLinked'),
              description: `${t('portal.relink.welcome')} ${inner.full_name || checkRes.data.customer_name || ''}`
            });
            await refetchCrm(); // تحديث state بعد التأكيد
          } else {
            // 📋 تشخيص: check_link_status ناجح لكن get_profile فشل
            console.warn('[Account] check_link_status=linked but get_profile failed:', profileData);
            toast({
              title: t('portal.relink.linkedButLoadFailed'),
              description: t('portal.relink.tryAgainOrSupport'),
              variant: 'destructive',
            });
          }
          
          setIsRelinking(false);
          return;
        }
      }
      
      // 🆕 Step 2: Not linked via session → try portal-verify with token
      const token = studentPortalToken || localStorage.getItem('student_portal_token');
      const customerId = localStorage.getItem('customer_id');
      
      if (!token) {
        localStorage.removeItem('student_portal_token');
        toast({
          title: t('portal.toast.linkExpired'),
          description: t('portal.toast.pleaseLoginAgain'),
          variant: 'destructive',
        });
        navigate('/?auth=1');
        return;
      }
      
      console.log('[Account] 🔗 Trying portal-verify with token...');
      
      const { data, error } = await supabase.functions.invoke('portal-verify', {
        body: { token, customer_id: customerId }
      });
      
      console.log('[Account] 🔗 portal-verify response:', data, error);
      
      if (data?.ok && data?.action_link) {
        toast({ title: t('portal.relink.linked'), description: t('portal.relink.updatingSession') });
        window.location.href = data.action_link;
      } else if (data?.ok) {
        toast({ title: t('portal.relink.done'), description: t('portal.relink.accountLinkedSuccess') });
        await refetchCrm();
      } else {
        // 🆕 Handle specific error codes
        const errorCode = data?.error || 'UNKNOWN';
        
        if (errorCode === 'invalid_token' || errorCode === 'INVALID_TOKEN') {
          localStorage.removeItem('student_portal_token');
          toast({
            title: t('portal.toast.linkExpired'),
            description: t('portal.toast.pleaseLoginAgain'),
            variant: 'destructive',
          });
          navigate('/?auth=1');
        } else if (errorCode === 'CONFLICT' || errorCode === 'LINK_CONFLICT') {
          toast({
            title: t('portal.toast.connectionError'),
            description: t('portal.toast.tryAgain'),
            variant: 'destructive',
          });
        } else {
          toast({
            title: t('portal.toast.connectionError'),
            description: t('portal.toast.tryAgain'),
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      console.error('[Account] 🔗 Re-link error:', err);
      toast({
        title: t('portal.toast.connectionError'),
        description: t('portal.toast.serverConnectionFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsRelinking(false);
    }
  };
  const { shortlist } = useMalakChat();
  const shortlistCount = shortlist?.length ?? 0;

  // Wallet balance from CRM or default
  const walletBalance = (crmProfile as { wallet_balance?: number } | null)?.wallet_balance ?? 0;

  // ✅ Avatar update handler — SINGLE WRITE PATH ONLY
  // CRM is already updated by the upload flow (uploadAvatar → set_avatar).
  // Here we ONLY:
  //   1. Mirror the storage path locally in `profiles.avatar_storage_path` for portal-side display
  //   2. Refetch the CRM profile so the UI shows the new avatar_url
  // We DO NOT call updateCrmProfile({ avatar_url }) — that would overwrite the
  // public URL written by set_avatar with a raw storage path.
  const handleAvatarUpdate = async (path: string | null): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .upsert(
            { user_id: user.id, avatar_storage_path: path },
            { onConflict: 'user_id' }
          );
      }

      // ✅ CRM already has the avatar (set_avatar wrote the public URL).
      // Just refresh the cached profile so UI picks up the new avatar_url.
      if (!isTeacher) {
        await refetchCrm();
      }

      return true;
    } catch (e) {
      console.error('handleAvatarUpdate failed:', e);
      return false;
    }
  };

  // Auto-sync: if CRM has avatar but profiles table doesn't, sync it
  useEffect(() => {
    (async () => {
      const crmAvatar = crmProfile?.avatar_url;
      if (!crmAvatar || profile?.avatar_storage_path) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').upsert(
            { user_id: user.id, avatar_storage_path: crmAvatar },
            { onConflict: 'user_id' }
          );
          console.log('[Account] Auto-synced CRM avatar to profiles table');
        }
      } catch (e) {
        console.warn('[Account] Auto-sync avatar failed:', e);
      }
    })();
  }, [crmProfile?.avatar_url, profile?.avatar_storage_path]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return isTeacher ? (
          <TeacherAccountOverview
            profile={profile}
            crmProfile={crmProfile}
            teacherProfile={teacherProfile}
            onEditProfile={() => setActiveTab('settings')}
            onAvatarUpdate={handleAvatarUpdate}
          />
        ) : (
          <DashboardOverview
            profile={profile}
            crmProfile={crmProfile}
            progress={progress}
            docsCount={docsCount}
            docsTotal={docsTotal}
            paymentPaid={paymentPaid}
            paymentRequired={paymentRequired}
            applicationsCount={applicationsCount}
            shortlistCount={shortlistCount}
            walletBalance={walletBalance}
            onNavigate={setActiveTab}
            onEditProfile={() => setActiveTab('study-file')}
            onAvatarUpdate={handleAvatarUpdate}
          />
        );
      case 'study-file':
      case 'profile':
      case 'readiness':
      case 'documents':
        return (
          <StudyFileTab
            profile={profile!}
            crmProfile={crmProfile}
            onUpdate={updateCrmProfile}
            onRefetch={refetchCrm}
            onTabChange={setActiveTab}
            onAvatarUpdate={handleAvatarUpdate}
            fileQuality={fileQuality}
          />
        );
      case 'applications':
        return <ApplicationsTab crmProfile={crmProfile} onUpdate={updateCrmProfile} onTabChange={setActiveTab} />;
      case 'case':
        return <CaseStatusTab applicationId={searchParams.get('application_id') || undefined} />;
      case 'payments':
        return <PaymentsTab />;
      case 'shortlist':
        return <ShortlistTab onTabChange={setActiveTab} onStartProgram={handleStartProgram} />;
      case 'wallet':
      case 'wallet-overview':
      case 'wallet-history':
        return <WalletTab />;
      case 'visa':
        return <VisaTab onTabChange={setActiveTab} />;
      case 'settings':
        return (
          <SettingsTab
            email={profile?.email}
            phone={profile?.phone || crmProfile?.phone}
            hasLoginCredentials={!!profile?.email}
          />
        );
      case 'services':
        return (
          <ServicesTab 
            key={`services-${programIdFromUrl || 'none'}`}
            onTabChange={setActiveTab} 
            initialProgramId={programIdFromUrl}
            onClearProgramAndGoToFavorites={handleClearProgramAndGoToFavorites}
          />
        );
      case 'teacher-verification':
        return <TeacherVerificationTab profile={teacherProfile} />;
      case 'teacher-documents':
        return <TeacherDocumentsTab profile={teacherProfile} />;
      case 'messages':
        return (
          <div className="h-[calc(100vh-200px)] border border-border rounded-lg overflow-hidden">
            <StudentInbox />
          </div>
        );
      default:
        return null;
    }
  };

  // ✅ P0.2 Final: Golden Gate Rule - NEVER show login during any pending/callback state
  const authPendingActive = isAuthPending();
  const isPollingSession = authPendingActive && !hasSession;
  
  // Gate: Show loader if ANY of these conditions are true
  const needsAuthGate = 
    !sessionReady || 
    isVerifyingToken || 
    (isAuthCallback && !hasSession) || 
    isPollingSession ||
    tokenExchangeInProgress.current;
  
  if (needsAuthGate) {
    return (
        <div className="min-h-screen bg-muted/30">
        <ProfileSkeleton />
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('portal.loading.openingAccount')}</p>
        </div>
      </div>
    );
  }
  
  // ✅ P0.1 Fix: If session exists but CRM still loading → separate loader
  if (hasSession && (loading || crmLoading)) {
    return (
      <div className="min-h-screen bg-muted/30">
        <ProfileSkeleton />
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('portal.loading.loadingProfile')}</p>
        </div>
      </div>
    );
  }

  // Calculate stats - local progress based on filled fields + documents
  const progress = calculateProfileProgress(crmProfile, studentDocs);
  const docsCount = studentDocs.length; // Real uploaded documents count
  const docsTotal = crmProfile?.counts?.documents_total ?? 5; // From CRM or default
  const paymentPaid = crmProfile?.payment_total_paid ?? 0;
  const paymentRequired = crmProfile?.payment_total_required ?? 0;
  const applicationsCount = crmProfile?.applications_count ?? 0;

  return (
    <>
      <OfflineIndicator />
      <UpdateNotification />
      
      <div className="min-h-screen bg-muted/30">
        {/* ✅ Single Entry Point: NO Email/Password - OTP only via AuthModal */}
        {!hasSession ? (
          // Simple prompt - directs to chat/AuthModal for OTP
          <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md text-center">
              {/* Logo/Header */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-4">
                <span className="text-2xl font-bold text-primary-foreground">CSW</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{t('portal.login.title')}</h1>
              <p className="text-muted-foreground mb-8">{t('portal.login.description')}</p>
              
              <div className="bg-card rounded-2xl shadow-lg border border-border p-6 md:p-8 space-y-4">
                <Button 
                  onClick={() => {
                    // Navigate to homepage and open AuthModal (canonical entry)
                    navigate('/?auth=1');
                  }} 
                  className="w-full h-12 bg-gradient-primary hover:opacity-90 text-base"
                >
                  {t('portal.login.button')}
                </Button>
                <Button 
                  onClick={() => navigate('/')} 
                  variant="outline"
                  className="w-full h-10"
                >
                  {t('portal.login.backToHome')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Main Dashboard - Binance-style layout
          <div className="min-h-screen flex flex-col" dir="rtl">
            
            {/* Content area with sidebar */}
            <div className="flex-1 flex">
              {/* Sidebar - On RIGHT for RTL */}
              <AccountSidebar 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                onTabHover={handleTabHover}
                progress={progress}
                currentStep={Math.min(Math.ceil(progress / 11.11), 9) || 1}
                isTeacher={isTeacher}
              />

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Top Bar with Home button */}
                <AccountTopBar 
                  phone={profile?.phone} 
                  onWalletClick={() => setActiveTab('wallet')}
                  onSettingsClick={() => setActiveTab('settings')}
                />
              {/* 🔗 Re-link Banner for old sessions */}
              {profileError === 'no_linked_customer' && !isTeacher && (
                <Alert className="mx-8 mt-4 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="flex items-center justify-between flex-wrap gap-2 mr-2">
                    <span className="text-amber-800 dark:text-amber-200">
                      ⚠️ حسابك غير مربوط بالكامل — التعديلات لن تُحفظ
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleRelink}
                        disabled={isRelinking}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {isRelinking ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
                        إعادة الربط
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate('/')}
                        className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
                      >
                        تسجيل الدخول من الشات
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Mobile Navigation */}
              <AccountMobileNav activeTab={activeTab} onTabChange={setActiveTab} isTeacher={isTeacher} />

              {/* Tab Content - Large padding like Binance */}
              <main 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-8"
              >
                <Suspense fallback={
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-1/3" />
                    <div className="h-64 bg-muted rounded-xl" />
                  </div>
                }>
                  {renderTabContent()}
                </Suspense>
              </main>
              </div>
            </div>
            
            {/* P7: Floating Student CTA */}
            {!isTeacher && <FloatingStudentCTA />}

            {/* Identity Activation Dialog is now owned by StudyFileTab (single canonical lock).
                Account.tsx no longer mounts it. */}

            {/* Footer */}
            <Footer />
            
          </div>
        )}
      </div>
    </>
  );
}

