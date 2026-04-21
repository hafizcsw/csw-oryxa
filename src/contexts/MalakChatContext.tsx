import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ChatMessage, University, ChatStatus, InputMode, StageInfo, SessionType, AccountRole, GuestState, ResultsSource, DebugInfo } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CardsPlanV1 } from '@/hooks/useCardsPlanReveal';
import { normalizePrograms } from '@/lib/program/validators';
// ✅ ORDER #1: Use Gateway for all CRM calls
import { sendChatEvent } from '@/lib/chat/gateway';
import { buildUiContextV1 } from '@/lib/uiContext';

// 🆕 Guest timing constants
const GUEST_HARD_LIMIT_MINUTES = 7;
const GUEST_COOLDOWN_HOURS = 24;

// 🆕 Idle timeout constants
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 دقيقة
const LAST_ACTIVITY_KEY = 'malak_last_activity_at';
const PORTAL_KEYS_TO_CLEAR = [
  'portal_draft_applications_v1',
  'portal_submission_cache_v1',
  'malak_chat_sessions',  // ✅ FloatingChat sessions
];

interface MalakChatContextType {
  messages: ChatMessage[];
  universities: University[];
  cardsPlan: CardsPlanV1 | null;  // 🆕 Sequential cards display plan
  showSuggestedPrograms: boolean;
  status: ChatStatus;
  sessionId: string;
  webUserId?: string;
  isOpen: boolean;
  customerId: string | null;
  normalizedPhone: string | null;
  stage: string | null;
  isNewCustomer: boolean;
  studentPortalToken: string | null;
  shortlist: string[];
  inputMode: InputMode;
  stageInfo: StageInfo | null;
  crmAvatarUrl: string | null; // ✅ Avatar URL from CRM
  // 🆕 P0: Results source tracking
  resultsSource: ResultsSource;
  debugInfo: DebugInfo;
  // 🆕 Auth Modal states
  sessionType: SessionType | null;
  guestSessionId: string | null;
  accountRole: AccountRole | null;
  // 🆕 Guest timing
  guestChatStartedAt: string | null;
  guestLockedUntil: string | null;
  // 🆕 Auth Modal control (unified across app)
  showAuthModal: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setUniversities: (universities: University[], showPrograms?: boolean, cardsPlan?: CardsPlanV1 | null, source?: ResultsSource) => void;
  setShowSuggestedPrograms: (show: boolean) => void;
  setStatus: (status: ChatStatus) => void;
  setWebUserId: (userId: string) => void;
  openChat: () => void;
  closeChat: () => void;
  clearHistory: () => void;
  fullLogout: (opts?: { reason?: 'manual' | 'idle' }) => Promise<void>;
  addToShortlist: (programId: string) => void;
  removeFromShortlist: (programId: string) => void;
  clearLocalShortlist: () => void;  // ✅ P0 Fix: Single operation clear
  setInputMode: (mode: InputMode) => void;
  // 🆕 P0: Clear results on error
  clearChatResults: () => void;
  updateDebugInfo: (info: Partial<DebugInfo>) => void;
  // 🆕 Auth session setters
  setGuestSession: (guestId: string) => void;
  setAuthenticatedSession: (data: {
    customer_id: string;
    student_portal_token: string;
    account_role?: AccountRole;
  }) => void;
  // 🆕 Guest timing functions
  resetGuestSessionTiming: () => void;
  markGuestHardLocked: () => void;
  updateCustomerData: (data: {
    customer_id?: string;
    normalized_phone?: string;
    stage?: string;
    is_new_customer?: boolean;
    student_portal_token?: string;
    need_phone?: boolean;
    need_name?: boolean;
    stage_info?: StageInfo | null;
    avatar_url?: string | null; // ✅ Avatar from CRM response
  }) => void;
}

const MalakChatContext = createContext<MalakChatContextType | undefined>(undefined);

const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export function MalakChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [cardsPlan, setCardsPlan] = useState<CardsPlanV1 | null>(null);  // 🆕
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem('malak_session_id');
    if (stored) return stored;
    const newId = generateSessionId();
    localStorage.setItem('malak_session_id', newId);
    return newId;
  });
  const [webUserId, setWebUserId] = useState<string>();
  const [isOpen, setIsOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState<boolean>(false);
  const [studentPortalToken, setStudentPortalToken] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [showSuggestedPrograms, setShowSuggestedPrograms] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('free');
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);
  const [crmAvatarUrl, setCrmAvatarUrl] = useState<string | null>(null); // ✅ Avatar from CRM
  // 🆕 Auth Modal states
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [guestSessionId, setGuestSessionIdState] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState<AccountRole | null>(null);
  // 🆕 Guest timing states
  const [guestChatStartedAt, setGuestChatStartedAt] = useState<string | null>(null);
  const [guestLockedUntil, setGuestLockedUntil] = useState<string | null>(null);
  // 🆕 Auth Modal control — now navigates to /auth page
  const [showAuthModal, setShowAuthModal] = useState(false);
  const openAuthModal = () => {
    // Navigate to dedicated auth page instead of showing modal
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
      window.location.href = '/auth';
    }
  };
  const closeAuthModal = () => setShowAuthModal(false);
  
  // 🆕 P0: Results source tracking - Single Source of Truth
  const [resultsSource, setResultsSource] = useState<ResultsSource>('none');
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    last_trace_id: null,
    last_request_id: null,
    last_cards_query: null,
    last_api_payload: null,
    last_api_total: null,
    last_rendered_count: 0,
    results_source: 'none',
    timestamp: Date.now()
  });


  // Load from localStorage on mount
  useEffect(() => {
    // ✅ لا نحتفظ بسجل رسائل بين الجلسات - نمسح أي بقايا قديمة
    localStorage.removeItem('malak_chat_history');

    const storedUserId = localStorage.getItem('web_user_id');
    if (storedUserId) setWebUserId(storedUserId);

    // Load customer data
    const savedCustomerId = localStorage.getItem('malak_customer_id');
    const savedPhone = localStorage.getItem('malak_normalized_phone');
    const savedStage = localStorage.getItem('malak_stage');
    const savedIsNew = localStorage.getItem('malak_is_new_customer');

    if (savedCustomerId) setCustomerId(savedCustomerId);
    if (savedPhone) setNormalizedPhone(savedPhone);
    if (savedStage) setStage(savedStage);
    if (savedIsNew) setIsNewCustomer(JSON.parse(savedIsNew));
    
    // Load student portal token
    const savedPortalToken = localStorage.getItem('student_portal_token');
    if (savedPortalToken) setStudentPortalToken(savedPortalToken);

    // Load shortlist - ✅ PATCH 1.2: Normalize IDs on load
    const savedShortlist = localStorage.getItem('guest_shortlist');
    if (savedShortlist) {
      try {
        const rawIds = JSON.parse(savedShortlist);
        // ✅ PATCH 1.2: Normalize ALL IDs to strings on hydration
        const normalized = Array.isArray(rawIds) 
          ? rawIds.map((x: any) => String(x ?? '')).filter(Boolean)
          : [];
        setShortlist(normalized);
      } catch {
        setShortlist([]);
      }
    }

    // 🆕 Load auth session data
    const savedSessionType = localStorage.getItem('malak_session_type') as SessionType | null;
    const savedGuestSessionId = localStorage.getItem('malak_guest_session_id');
    const savedAccountRole = localStorage.getItem('malak_account_role') as AccountRole | null;
    
    if (savedSessionType) setSessionType(savedSessionType);
    if (savedGuestSessionId) setGuestSessionIdState(savedGuestSessionId);
    if (savedAccountRole) setAccountRole(savedAccountRole);

    // 🆕 Load guest timing data
    const savedGuestTiming = localStorage.getItem('malak_guest_timing');
    if (savedGuestTiming) {
      try {
        const parsed = JSON.parse(savedGuestTiming);
        if (parsed.guestChatStartedAt) setGuestChatStartedAt(parsed.guestChatStartedAt);
        if (parsed.guestLockedUntil) setGuestLockedUntil(parsed.guestLockedUntil);
      } catch (e) {
        console.warn('[MalakChat] Failed to parse malak_guest_timing', e);
      }
    }
  }, []);

  // 🆕 تزامن تلقائي مع Supabase Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[MalakChat] 🔐 Auth state changed:', event, session?.user?.id);
      
      if (session?.user) {
        // المستخدم مسجل دخول في Supabase → تحديث sessionType
        if (sessionType !== 'authenticated') {
          setSessionType('authenticated');
          localStorage.setItem('malak_session_type', 'authenticated');
          console.log('[MalakChat] ✅ Auto-synced to authenticated');
        }
        
        // مسح قفل الضيف عند تسجيل الدخول
        setGuestChatStartedAt(null);
        setGuestLockedUntil(null);
        localStorage.removeItem('malak_guest_timing');
      } else if (event === 'SIGNED_OUT') {
        // ✅ SECURITY: Full cleanup on sign-out — prevent chat data leaking to next user
        console.log('[MalakChat] 🚪 Signed out, clearing ALL chat data');
        setSessionType(null);
        setMessages([]);
        setUniversities([]);
        setCustomerId(null);
        setNormalizedPhone(null);
        setStage(null);
        setIsNewCustomer(false);
        setStudentPortalToken(null);
        setWebUserId(undefined);
        setShortlist([]);
        setGuestChatStartedAt(null);
        setGuestLockedUntil(null);
        setGuestSessionIdState(null);
        setAccountRole(null);
        // Clear all malak localStorage keys
        localStorage.removeItem('malak_chat_history');
        localStorage.removeItem('malak_session_id');
        localStorage.removeItem('malak_session_type');
        localStorage.removeItem('malak_guest_session_id');
        localStorage.removeItem('malak_account_role');
        localStorage.removeItem('malak_customer_id');
        localStorage.removeItem('malak_normalized_phone');
        localStorage.removeItem('malak_stage');
        localStorage.removeItem('malak_is_new_customer');
        localStorage.removeItem('malak_guest_timing');
        localStorage.removeItem('malak_visitor_id');
        localStorage.removeItem('student_portal_token');
        localStorage.removeItem('web_user_id');
        localStorage.removeItem('guest_shortlist');
        // Generate fresh session
        const freshId = generateSessionId();
        localStorage.setItem('malak_session_id', freshId);
        setSessionId(freshId);
      } else if (event === 'INITIAL_SESSION' && !session) {
        // ✅ SECURITY: لا session عند البداية - تنظيف الحالة المتناقضة
        const storedType = localStorage.getItem('malak_session_type');
        if (storedType === 'authenticated') {
          console.log('[MalakChat] ⚠️ Stale authenticated state without session, clearing');
          setSessionType(null);
          localStorage.removeItem('malak_session_type');
          // لا نمسح student_portal_token هنا - قد يكون صالح ويحتاج token exchange
        }
      }
    });

    // فحص أولي عند التحميل
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log('[MalakChat] 🔐 Initial session detected:', session.user.id);
        if (sessionType !== 'authenticated') {
          setSessionType('authenticated');
          localStorage.setItem('malak_session_type', 'authenticated');
        }
      } else {
        // ✅ لا session عند البداية - تنظيف الحالة المتناقضة
        const storedType = localStorage.getItem('malak_session_type');
        if (storedType === 'authenticated') {
          console.log('[MalakChat] ⚠️ Initial: Stale authenticated state, clearing');
          setSessionType(null);
          localStorage.removeItem('malak_session_type');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [sessionType]);


  // Save to localStorage when messages or universities change (limit to last 50 messages)
  useEffect(() => {
    if (messages.length > 0 || universities.length > 0) {
      // ✅ نحصر التخزين في آخر 50 رسالة فقط لتجنب امتلاء localStorage
      const compactMessages = messages.slice(-50);
      
      localStorage.setItem('malak_chat_history', JSON.stringify({
        messages: compactMessages,
        universities,
      }));
    }
  }, [messages, universities]);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const openChat = () => setIsOpen(true);
  const closeChat = () => setIsOpen(false);

  const clearHistory = () => {
    setMessages([]);
    setUniversities([]);
    setShowSuggestedPrograms(false);
    setWebUserId(undefined);
    localStorage.removeItem('malak_chat_history');
    localStorage.removeItem('malak_session_id');
    localStorage.removeItem('web_user_id');
    
    // ⚠️ لا نمسح بيانات العميل - يبقى متحققاً منه
    // localStorage.removeItem('malak_customer_id');
    // localStorage.removeItem('malak_normalized_phone');
    
    // إنشاء session جديد
    const newSessionId = generateSessionId();
    localStorage.setItem('malak_session_id', newSessionId);
    setSessionId(newSessionId);
    
    // إعادة الـ stage لـ authenticated إذا العميل متحقق منه
    if (customerId) {
      setStage('authenticated');
      localStorage.setItem('malak_stage', 'authenticated');
    } else {
      setStage('initial');
      localStorage.removeItem('malak_stage');
    }
  };

  // تسجيل خروج كامل - يمسح كل البيانات
  const fullLogout = useCallback(async (opts?: { reason?: 'manual' | 'idle' }) => {
    setMessages([]);
    setUniversities([]);
    setShowSuggestedPrograms(false);
    setWebUserId(undefined);
    setCustomerId(null);
    setNormalizedPhone(null);
    setStage('initial');
    setIsNewCustomer(false);
    setStudentPortalToken(null);
    setShortlist([]);
    
    // ✅ MISSING RESETS - States الناقصة
    setInputMode('free');
    setStageInfo(null);
    setCrmAvatarUrl(null);
    
    // 🆕 Reset auth session
    setSessionType(null);
    setGuestSessionIdState(null);
    setAccountRole(null);
    // 🆕 Reset guest timing
    setGuestChatStartedAt(null);
    setGuestLockedUntil(null);
    
    // مسح كل localStorage
    localStorage.removeItem('malak_chat_history');
    localStorage.removeItem('malak_session_id');
    localStorage.removeItem('web_user_id');
    localStorage.removeItem('malak_customer_id');
    localStorage.removeItem('malak_normalized_phone');
    localStorage.removeItem('malak_stage');
    localStorage.removeItem('malak_is_new_customer');
    localStorage.removeItem('student_portal_token');
    localStorage.removeItem('guest_shortlist');
    // 🆕 Clear auth session
    localStorage.removeItem('malak_session_type');
    localStorage.removeItem('malak_guest_session_id');
    localStorage.removeItem('malak_account_role');
    // 🆕 Clear guest timing
    localStorage.removeItem('malak_guest_timing');
    // ✅ Clear idle tracking
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    // ✅ Clear portal keys
    for (const k of PORTAL_KEYS_TO_CLEAR) {
      localStorage.removeItem(k);
    }
    
    // Supabase signout
    try {
      await supabase.auth.signOut();
    } catch {}
    
    // إنشاء session جديد
    const newSessionId = generateSessionId();
    localStorage.setItem('malak_session_id', newSessionId);
    setSessionId(newSessionId);
    
    // ✅ Toast للـ idle logout
    if (opts?.reason === 'idle') {
      toast.info('تم تسجيل الخروج بسبب عدم النشاط');
    }
  }, []);

  // 🆕 Idle Tracker - خروج تلقائي بعد 30 دقيقة بدون نشاط
  const touchActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }, []);

  useEffect(() => {
    // فقط للمستخدمين المسجلين
    if (sessionType !== 'authenticated') return;
    
    // ✅ FIX: دائماً تحديث النشاط عند mount - هذا يمنع استخدام timestamp قديم من جلسة سابقة
    touchActivity();
    
    // التقاط أي نشاط (مع throttling)
    let ticking = false;
    const onAnyActivity = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        touchActivity();
      });
    };
    
    // ✅ FIX: إضافة visibilitychange و focus لتحديث النشاط عند العودة للتبويب
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' || document.hasFocus()) {
        touchActivity();
      }
    };
    
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, onAnyActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);
    
    // ✅ FIX: حماية إضافية - إذا كان الـ timestamp قديم جداً (> 24 ساعة) = بقايا جلسة قديمة
    const MAX_VALID_AGE = 24 * 60 * 60 * 1000; // 24 ساعة
    
    // فحص كل 30 ثانية
    const interval = window.setInterval(() => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || '0');
      if (!last) return;
      const idleFor = Date.now() - last;
      
      // إذا كان الـ timestamp قديم جداً، تجديد بدل logout
      if (idleFor > MAX_VALID_AGE) {
        touchActivity();
        return;
      }
      
      if (idleFor > IDLE_TIMEOUT_MS) {
        fullLogout({ reason: 'idle' });
      }
    }, 30_000);
    
    return () => {
      events.forEach(e => window.removeEventListener(e, onAnyActivity as EventListener));
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [sessionType, touchActivity, fullLogout]);

  // 🆕 Set guest session with timing initialization
  const setGuestSession = (guestId: string) => {
    setSessionType('guest');
    setGuestSessionIdState(guestId);
    setAccountRole(null);
    
    localStorage.setItem('malak_session_type', 'guest');
    localStorage.setItem('malak_guest_session_id', guestId);
    localStorage.removeItem('malak_account_role');
    localStorage.removeItem('malak_customer_id');
    localStorage.removeItem('student_portal_token');
    
    // 🆕 بدء توقيت الضيف
    const nowIso = new Date().toISOString();
    setGuestChatStartedAt(nowIso);
    setGuestLockedUntil(null);
    localStorage.setItem('malak_guest_timing', JSON.stringify({
      guestChatStartedAt: nowIso,
      guestLockedUntil: null
    }));
    
    console.log('[MalakChatContext] ✅ Guest session set with timing:', guestId);
  };

  // 🆕 Set authenticated session (PORTAL-3: preserves messages, sends link event)
  const setAuthenticatedSession = async (data: {
    customer_id: string;
    student_portal_token: string;
    account_role?: AccountRole;
    // 🆕 PORTAL-3: Optional flag to merge guest memory
    merge_guest_memory?: boolean;
  }) => {
    // 🆕 PORTAL-3: Capture guest_session_id before clearing it
    const previousGuestSessionId = guestSessionId;
    
    setSessionType('authenticated');
    setGuestSessionIdState(null);
    setCustomerId(data.customer_id);
    setStudentPortalToken(data.student_portal_token);
    if (data.account_role) setAccountRole(data.account_role);
    setStage('authenticated');
    
    localStorage.setItem('malak_session_type', 'authenticated');
    localStorage.removeItem('malak_guest_session_id');
    localStorage.setItem('malak_customer_id', data.customer_id);
    localStorage.setItem('student_portal_token', data.student_portal_token);
    if (data.account_role) localStorage.setItem('malak_account_role', data.account_role);
    localStorage.setItem('malak_stage', 'authenticated');
    
    // 🆕 مهم جداً: حذف أي قفل/تايمر ضيف
    setGuestChatStartedAt(null);
    setGuestLockedUntil(null);
    localStorage.removeItem('malak_guest_timing');
    
    // 🆕 PORTAL-3: Messages are NOT cleared - session continues
    console.log('[MalakChatContext] ✅ Authenticated session set (messages preserved):', data.customer_id);
    
    // 🆕 PORTAL-3: Send linked_session_to_customer event to CRM
    if (previousGuestSessionId && data.merge_guest_memory !== false) {
      try {
        // ✅ ORDER #1: Use Gateway for all CRM calls
        const ui_context = buildUiContextV1({
          pathname: window.location.pathname,
          tab: null,
          lang: 'ar'
        });
        
        await sendChatEvent({
          name: 'linked_session_to_customer',
          payload: {
            guest_session_id: previousGuestSessionId,
            customer_id: data.customer_id,
            merge_memory: true,
          },
          visitor_id: localStorage.getItem('malak_visitor_id') || crypto.randomUUID(),
          session_id: sessionId,
          ui_context,
        });
        console.log('[MalakChatContext] 📤 Sent linked_session_to_customer event to CRM');
      } catch (e) {
        console.warn('[MalakChatContext] ⚠️ Failed to send link event (non-fatal):', e);
      }
    }
  };

  // 🆕 إعادة ضبط توقيت الضيف
  const resetGuestSessionTiming = () => {
    const nowIso = new Date().toISOString();
    setGuestChatStartedAt(nowIso);
    setGuestLockedUntil(null);
    localStorage.setItem('malak_guest_timing', JSON.stringify({
      guestChatStartedAt: nowIso,
      guestLockedUntil: null
    }));
    console.log('[MalakChatContext] 🔄 Guest timing reset');
  };

  // 🆕 تفعيل قفل الـ 24 ساعة
  const markGuestHardLocked = () => {
    const now = new Date();
    const lockUntil = new Date(now.getTime() + GUEST_COOLDOWN_HOURS * 60 * 60 * 1000);
    const lockIso = lockUntil.toISOString();
    
    setGuestLockedUntil(lockIso);
    localStorage.setItem('malak_guest_timing', JSON.stringify({
      guestChatStartedAt,
      guestLockedUntil: lockIso
    }));
    console.log('[MalakChatContext] 🔒 Guest hard locked until:', lockIso);
  };

  const handleSetWebUserId = (userId: string) => {
    setWebUserId(userId);
    localStorage.setItem('web_user_id', userId);
  };

  // ✅ PATCH 1.2: Normalize ID helper - ensures consistent string format
  const normId = (id: any): string => String(id ?? '').trim();

  // Shortlist functions
  const addToShortlist = (programId: string) => {
    // ✅ PATCH 1.2: Normalize ID before any operation
    const normalizedId = normId(programId);
    if (!normalizedId) {
      console.warn('[MalakChatContext] ⛔ Empty ID, not adding');
      return;
    }
    
    console.log('[MalakChatContext] ➕ addToShortlist called:', normalizedId);
    console.log('[MalakChatContext] Current shortlist before add:', shortlist);
    
    setShortlist(prev => {
      if (prev.length >= 5) {
        console.log('[MalakChatContext] ⛔ Max 5 reached, not adding');
        return prev;
      }
      // ✅ PATCH 1.2: Compare normalized IDs
      if (prev.some(id => normId(id) === normalizedId)) {
        console.log('[MalakChatContext] ⛔ Already in shortlist, not adding');
        return prev;
      }
      const updated = [...prev, normalizedId];
      localStorage.setItem('guest_shortlist', JSON.stringify(updated));
      console.log('[MalakChatContext] ✅ Saved to localStorage:', updated);
      console.log('[MalakChatContext] Verify localStorage:', localStorage.getItem('guest_shortlist'));
      window.dispatchEvent(new CustomEvent('shortlist-updated'));
      return updated;
    });
  };

  const removeFromShortlist = (programId: string) => {
    // ✅ PATCH 1.2: Normalize ID before any operation
    const normalizedId = normId(programId);
    console.log('[MalakChatContext] ➖ removeFromShortlist called:', normalizedId);
    
    setShortlist(prev => {
      // ✅ PATCH 1.2: Filter using normalized comparison
      const updated = prev.filter(id => normId(id) !== normalizedId);
      localStorage.setItem('guest_shortlist', JSON.stringify(updated));
      console.log('[MalakChatContext] ✅ Removed, saved to localStorage:', updated);
      window.dispatchEvent(new CustomEvent('shortlist-updated'));
      return updated;
    });
  };

  // ✅ P0 Fix: Clear all shortlist in single operation (no loop)
  const clearLocalShortlist = () => {
    console.log('[MalakChatContext] 🗑️ clearLocalShortlist called');
    setShortlist([]);
    localStorage.setItem('guest_shortlist', JSON.stringify([]));
    console.log('[MalakChatContext] ✅ Cleared all shortlist');
    window.dispatchEvent(new CustomEvent('shortlist-updated'));
  };

  const updateCustomerData = (data: {
    customer_id?: string;
    normalized_phone?: string;
    stage?: string;
    is_new_customer?: boolean;
    student_portal_token?: string;
    need_phone?: boolean;
    need_name?: boolean;
    stage_info?: StageInfo | null;
    avatar_url?: string | null; // ✅ Avatar from CRM response
  }) => {
    if (data.customer_id) {
      setCustomerId(data.customer_id);
      localStorage.setItem('malak_customer_id', data.customer_id);
    }
    if (data.normalized_phone) {
      setNormalizedPhone(data.normalized_phone);
      localStorage.setItem('malak_normalized_phone', data.normalized_phone);
    }
    if (data.stage) {
      setStage(data.stage);
      localStorage.setItem('malak_stage', data.stage);
    }
    if (typeof data.is_new_customer === 'boolean') {
      setIsNewCustomer(data.is_new_customer);
      localStorage.setItem('malak_is_new_customer', JSON.stringify(data.is_new_customer));
    }
    if (data.student_portal_token) {
      setStudentPortalToken(data.student_portal_token);
      localStorage.setItem('student_portal_token', data.student_portal_token);
      
      // 🆕 تحديث sessionType تلقائياً عند استلام token
      setSessionType('authenticated');
      localStorage.setItem('malak_session_type', 'authenticated');
      
      // 🆕 مسح قفل/تايمر الضيف
      setGuestChatStartedAt(null);
      setGuestLockedUntil(null);
      localStorage.removeItem('malak_guest_timing');
      localStorage.removeItem('malak_guest_session_id');
      setGuestSessionIdState(null);
      
      console.log('[MalakChatContext] 🔓 Token received - switched to authenticated session');
    }

    // 🆕 تخزين stage_info في الذاكرة (بدون localStorage)
    if (typeof data.stage_info !== 'undefined') {
      setStageInfo(data.stage_info);
    }

    // ✅ تحديث avatar_url من CRM
    if (typeof data.avatar_url !== 'undefined') {
      setCrmAvatarUrl(data.avatar_url);
    }

    // ✅ تحديث inputMode تلقائياً حسب الـ response
    let nextInputMode: InputMode = 'free';
    if (data.need_phone) {
      nextInputMode = 'phone';
    } else if (data.stage === 'awaiting_otp') {
      nextInputMode = 'otp';
    } else if (data.need_name) {
      nextInputMode = 'name';
    }
    setInputMode(nextInputMode);
  };

  // Wrapper to set universities - عرض تلقائي إذا وجدت برامج
  const handleSetUniversities = (unis: University[], showPrograms: boolean = true, plan?: CardsPlanV1 | null, source: ResultsSource = 'chat_cards') => {
    // ✅ P0: Single adapter boundary — normalize program_id → id and drop invalid rows
    const normalizedUnis = normalizePrograms(unis) as unknown as University[];
    console.log('[MalakChatContext] 🎓 setUniversities called:', {
      count: normalizedUnis.length,
      showPrograms,
      hasCardsPlan: !!plan,
      source
    });
    setUniversities(normalizedUnis);
    setCardsPlan(plan || null);  // 🆕 Fix #4: Set cardsPlan from response
    setResultsSource(source);  // 🆕 P0: Track source
    
    // ✅ عرض البرامج تلقائياً إذا وجدت (CRM يقرر متى يرسل)
    if (normalizedUnis.length > 0) {
      console.log('[MalakChatContext] ✅ Auto-showing suggested programs');
      setShowSuggestedPrograms(true);
    } else {
      console.log('[MalakChatContext] ⛔ Hiding suggested programs (empty array)');
      setShowSuggestedPrograms(false);
    }
  };

  // 🆕 P0: Clear chat-driven results (on error)
  const clearChatResults = useCallback(() => {
    console.log('[MalakChatContext] 🧹 Clearing chat results on error');
    setUniversities([]);
    setCardsPlan(null);
    setShowSuggestedPrograms(false);
    setResultsSource('none');
  }, []);

  // 🆕 P0: Update debug info for traceability
  const updateDebugInfo = useCallback((info: Partial<DebugInfo>) => {
    setDebugInfo(prev => ({
      ...prev,
      ...info,
      timestamp: Date.now()
    }));
  }, []);

  return (
    <MalakChatContext.Provider
      value={{
        messages,
        universities,
        cardsPlan,  // 🆕
        showSuggestedPrograms,
        status,
        sessionId,
        webUserId,
        isOpen,
        customerId,
        normalizedPhone,
        stage,
        isNewCustomer,
        studentPortalToken,
        shortlist,
        inputMode,
        stageInfo,
        crmAvatarUrl,
        // 🆕 Auth Modal states
        sessionType,
        guestSessionId,
        accountRole,
        // 🆕 Guest timing
        guestChatStartedAt,
        guestLockedUntil,
        // 🆕 P0: Results source tracking
        resultsSource,
        debugInfo,
        // 🆕 Auth Modal control
        showAuthModal,
        openAuthModal,
        closeAuthModal,
        addMessage,
        setUniversities: handleSetUniversities,
        setShowSuggestedPrograms,
        setStatus,
        setWebUserId: handleSetWebUserId,
        openChat,
        closeChat,
        clearHistory,
        fullLogout,
        addToShortlist,
        removeFromShortlist,
        clearLocalShortlist,  // ✅ P0 Fix
        setInputMode,
        // 🆕 P0: Error handling
        clearChatResults,
        updateDebugInfo,
        // 🆕 Auth session setters
        setGuestSession,
        setAuthenticatedSession,
        // 🆕 Guest timing functions
        resetGuestSessionTiming,
        markGuestHardLocked,
        updateCustomerData,
      }}
    >
      {children}
    </MalakChatContext.Provider>
  );
}

export function useMalakChat() {
  const context = useContext(MalakChatContext);
  if (!context) {
    throw new Error('useMalakChat must be used within MalakChatProvider');
  }
  return context;
}
