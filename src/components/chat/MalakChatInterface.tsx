import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useStaffAuthority } from '@/hooks/useStaffAuthority';
import { useSmartScroll } from '@/hooks/useSmartScroll';
import { flushSync, createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { useChat } from '@/contexts/ChatContext';
import { useMalakAssistant } from '@/hooks/useMalakAssistant';
import { useBotTelemetry } from '@/hooks/useBotTelemetry';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useStudentTour } from '@/contexts/StudentTourContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCRMEventExecutor } from '@/hooks/useCRMEventExecutor';
import { useCardsQuery } from '@/hooks/useCardsQuery';  // 🆕 Cards Pipeline
import { useACKSender } from '@/hooks/useACKSender';
import { WebChatMessage, normalizeCRMResponse } from '@/types/crm';
import AnomalyOrb from '@/components/orb/AnomalyOrb';
import oryxaAvatar from '@/assets/oryxa-avatar-regen.png';
import { ChatMessage } from './ChatMessage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
// ✅ Chat history persistence disabled — keep only ephemeral in-memory chat
import { clearAllHistory } from '@/lib/chat/history';
import {
  getSessionIdentifiers,
  persistIdsFromResponse,
} from '@/lib/chat/session';
// ✅ T5 FIX: Import state machine to gate search
import { shouldTriggerSearch, detectConsentPhase, ConsentState } from '@/lib/chat/state';
import { validateCardsQuery, validateSearchTrigger } from '@/lib/chat/guards/contractGuard';
import { sendPortalEvent, PORTAL_EVENTS } from '@/lib/chat/telemetry';
import { createAndStoreCrmTraceId } from '@/lib/crmHeaders';
import {
  hasFilters,
  isClarifyPayload,
  mergeClarifyFilters,
  parseFilterTokensFromText,
  shouldShowEmptyResponseFallback,
  type ClarifyFilters,
} from '@/lib/chat/clarify';
// ✅ P0 FIX: Static import for instant ACK (no dynamic import delay)
import { fastRoute } from '@/lib/chat/fastRouter';
// ✅ Build Stamp for environment verification
import { BuildStamp, InlineBuildStamp } from './BuildStamp';
// ✅ 3-Phase Workflow: Consent Banner
import { ConsentBanner } from './ConsentBanner';

import { AIIcon } from '@/components/icons/AIIcon';
import { TypewriterPlaceholder } from './TypewriterPlaceholder';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
// Native scroll used instead of ScrollArea for better compatibility
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Trash2, AlertCircle, Sparkles, Search, Loader2, Mic, MicOff, Square, User, ChevronDown, Clock, X, Plus, Check, ArrowUp, History, PanelLeftClose, PanelLeft, Maximize2, Minimize2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { consumeQueuedCompareRequestPayload } from '@/lib/portalApi';

// 🆕 Guest timing constant (7 minutes)
const GUEST_HARD_LIMIT_MS = 7 * 60 * 1000;
const getClarifyFiltersStorageKey = (threadKey: string) => `portal_clarify_filters_v1:${threadKey}`;

// ✅ P0: Smart error message parser for clear UX
interface SmartErrorResult {
  message: string;
  code?: string;
  retryable: boolean;
}

function getSmartErrorMessage(err: any, t: (key: string) => string): SmartErrorResult {
  const msg = String(err?.message || err?.details || err || '');
  const code = err?.code || err?.error_code || '';
  
  // Check for specific error codes/patterns
  if (msg.includes('MISSING_API_KEY_CONFIG') || code === 'MISSING_API_KEY_CONFIG') {
    return { 
      message: t('portal.chat.errors.configUnavailable'),
      code: 'CONFIG_ERROR',
      retryable: false 
    };
  }
  
  if (msg.includes('503') || msg.includes('502') || msg.includes('504')) {
    return { 
      message: t('portal.chat.errors.serviceBusy'),
      code: 'SERVICE_BUSY',
      retryable: true 
    };
  }
  
  if (msg.includes('timeout') || msg.includes('TIMEOUT') || msg.includes('ETIMEDOUT')) {
    return { 
      message: t('portal.chat.errors.timeout'),
      code: 'TIMEOUT',
      retryable: true 
    };
  }
  
  if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
    return { 
      message: t('portal.chat.errors.authExpired'),
      code: 'AUTH_EXPIRED',
      retryable: false 
    };
  }
  
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_NETWORK')) {
    return { 
      message: t('portal.chat.errors.networkError'),
      code: 'NETWORK_ERROR',
      retryable: true 
    };
  }
  
  if (msg.includes('CORS') || msg.includes('cross-origin')) {
    return { 
      message: t('portal.chat.errors.corsError'),
      code: 'CORS_ERROR',
      retryable: false 
    };
  }
  
  // Default error
  return { 
    message: t('portal.chat.errors.unknown'),
    code: 'UNKNOWN',
    retryable: true 
  };
}
interface MalakChatInterfaceProps {
  variant?: 'standalone' | 'floating';
  isInDeepSearch?: boolean;
  /** Compact landing mode: hides welcome orb + suggested prompts, shows rotating placeholder. */
  compact?: boolean;
  /** Called when message count changes; useful for parent layout adjustments. */
  onMessagesCountChange?: (count: number) => void;
}
export function MalakChatInterface({
  variant = 'standalone',
  isInDeepSearch = false,
  compact = false,
  onMessagesCountChange,
}: MalakChatInterfaceProps) {
  const isFloating = variant === 'floating';
  const isMobile = useIsMobile();
  const chatCtx = useChat();
  const isCompactMobileStandalone = isMobile && !isFloating;
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const { role: staffRole } = useStaffAuthority();
  const isSuperAdmin = staffRole === 'super_admin';
  const isChatPaused = false; // ✅ Chat enabled for everyone
  
  // Dynamic suggested prompts based on language
  const SUGGESTED_PROMPTS = useMemo(() => [
    t("bot.prompt.russia"),
    t("bot.prompt.medicine"),
    t("bot.prompt.scholarship"),
    t("bot.prompt.engineering")
  ], [t]);
  
  const {
    sessionId,
    webUserId,
    clearHistory,
    customerId,
    stage,
    isNewCustomer,
    updateCustomerData,
    setUniversities,
    studentPortalToken,
    inputMode,
    stageInfo,
    // 🆕 Auth session data
    sessionType,
    guestSessionId,
    // 🆕 Guest timing
    guestChatStartedAt,
    guestLockedUntil,
    markGuestHardLocked,
    openAuthModal,
    // 🆕 Deep Search mode detection
    showSuggestedPrograms,
    universities,
    // 🆕 P0: Error handling & debug
    clearChatResults,
    updateDebugInfo,
    debugInfo
  } = useMalakChat();
  const {
    sendMessage
  } = useMalakAssistant();
  
  // 🆕 Cards Pipeline: Fetch from Portal Catalog based on CRM cards_query
  const { fetchCards, resetSequence } = useCardsQuery();
  const { sendACK } = useACKSender();
  
  // P5: Refresh data callback for event executor
  const handleRefreshData = useCallback(() => {
    console.log('[MalakChat] 🔄 Refresh data triggered by CRM event');
    // Dispatch custom event that components can listen to
    window.dispatchEvent(new CustomEvent('crm-refresh-data'));
  }, []);
  
  const { executeResponseEvents } = useCRMEventExecutor({ 
    openAuthModal,
    onRefreshData: handleRefreshData
  });
  const telemetry = useBotTelemetry();
  const {
    startTour
  } = useStudentTour();
  const navigate = useNavigate();

  // Local state for new format
  const [messages, setMessages] = useState<(WebChatMessage & { isNew?: boolean })[]>([]);
  // Notify parent when message count changes (used by Hero for layout)
  useEffect(() => {
    onMessagesCountChange?.(messages.length);
  }, [messages.length, onMessagesCountChange]);
  const [state, setState] = useState<'idle' | 'thinking' | 'awaiting_phone' | 'awaiting_otp' | 'awaiting_name' | 'searching' | 'awaiting_consent'>('idle');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'normal' | 'deep'>('normal');
  const [ctaDismissed, setCtaDismissed] = useState(false);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [showStatusBar, setShowStatusBar] = useState(false); // 🆕 شريط الحالة مخفي افتراضياً
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionFilters, setSessionFilters] = useState<ClarifyFilters>({});
  
  // ✅ 3-Phase Workflow: Consent state
  const [consentState, setConsentState] = useState<ConsentState | null>(null);
  const [isConsentLoading, setIsConsentLoading] = useState(false);
  
  const threadKey = useMemo(() => sessionId || 'ephemeral', [sessionId]);

  useEffect(() => {
    clearAllHistory();
    try {
      sessionStorage.removeItem(getClarifyFiltersStorageKey(threadKey));
    } catch {
      // no-op
    }
    setMessages([]);
  }, [threadKey]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(getClarifyFiltersStorageKey(threadKey));
      if (!raw) {
        setSessionFilters({});
        return;
      }
      const parsed = JSON.parse(raw) as ClarifyFilters;
      setSessionFilters(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      setSessionFilters({});
    }
  }, [threadKey]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🆕 Cards Pipeline: Dedup + Abort refs to prevent race conditions
  const lastCardsKeyRef = useRef<string | null>(null);
  const cardsAbortRef = useRef<AbortController | null>(null);
  const pendingAckRef = useRef<{query_id:string;sequence:number;count:number}|null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [lastCardsQuery, setLastCardsQuery] = useState<any | null>(null);

  /* Clarify UI state removed — search is conversational via bot only */
  const {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    cancelRecording
  } = useVoiceRecorder();

  // 🆕 دالة حساب حالة التوقيت للضيف
  const getGuestTimingState = useCallback(() => {
    if (!guestChatStartedAt) {
      return {
        elapsedMs: 0,
        isTimeOver: false,
        isCooldown: false
      };
    }
    const now = Date.now();
    const started = new Date(guestChatStartedAt).getTime();
    const elapsedMs = Math.max(0, now - started);

    let isCooldown = false;
    if (guestLockedUntil) {
      const lockedUntilMs = new Date(guestLockedUntil).getTime();
      if (now < lockedUntilMs) {
        isCooldown = true;
      }
    }
    const isTimeOver = elapsedMs >= GUEST_HARD_LIMIT_MS;
    return {
      elapsedMs,
      isTimeOver,
      isCooldown
    };
  }, [guestChatStartedAt, guestLockedUntil]);

  // 🆕 إلغاء قفل الضيف تلقائياً بعد نجاح المصادقة
  useEffect(() => {
    if (studentPortalToken && guestLimitReached) {
      console.log('[MalakChat] ✅ Auth detected, unlocking guest limit');
      setGuestLimitReached(false);
    }
  }, [studentPortalToken, guestLimitReached]);
  const hasMessages = messages.length > 0;

  // ✅ الترحيب الأول المخزن لمنع التكرار
  const firstBotGreeting = useRef<string | null>(null);

  // Fix #1: Generate persistent visitor_id (different from session_id)
  // Uses crypto.randomUUID() for collision-free IDs
  const visitorId = useMemo(() => {
    const VISITOR_KEY = 'malak_visitor_id';
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
      console.log('[MalakChat] 🆕 Created new visitor_id:', id);
    }
    return id;
  }, []);

  // 🆕 تحديد session_type بشكل أذكى (يأخذ بالاعتبار كل مصادر المصادقة)
  const effectiveSessionType = useMemo(() => {
    if (studentPortalToken) return 'authenticated';
    if (customerId) return 'authenticated';
    return sessionType || 'guest';
  }, [studentPortalToken, customerId, sessionType]);

  // ✅ Smart Auto-scroll - handles typing states and typewriter effect
  const hasNewMessage = useMemo(() => 
    messages.some(m => (m as any).isNew === true),
    [messages]
  );

  const { scrollRef, handleScroll } = useSmartScroll({
    messagesCount: messages.length,
    isTyping: state === 'thinking' || state === 'searching',
    hasNewMessage
  });

  // 🆕 حساب حالة القفل المحدثة
  const {
    isTimeOver,
    isCooldown
  } = getGuestTimingState();

  // 🆕 حساب حالة قفل الإدخال للضيف (محدث مع التوقيت)
  const isGuestLocked = sessionType === 'guest' && (guestLimitReached || isTimeOver || isCooldown);
  
  // 🆕 دالة فحص طلب الحالة من المستخدم
  const checkForStatusRequest = useCallback((message: string) => {
    const normalized = message.trim().toLowerCase();
    const statusKeywords = [
      'حالة حسابي',
      'حالتي',
      'وضعي',
      'وضع حسابي',
      'ملفي',
      'حالة ملفي',
      'وين وصلت',
      'وين ملفي',
      'حالة طلبي',
      'my status',
      'my account',
      'account status'
    ];
    
    if (statusKeywords.some(kw => normalized.includes(kw))) {
      setShowStatusBar(true);
    }
  }, []);

  // ✅ P0: Import fast router for instant ACK
  const handleSend = useCallback(async (text?: string, extraParams?: Record<string, any>) => {
    const messageText = text || inputValue.trim();
    if (!messageText) return;
    if (state === 'thinking') {
      sendPortalEvent(PORTAL_EVENTS.SEND_BLOCKED_DUP, { timestamp: new Date().toISOString() });
      return;
    }
    
    // 🆕 فحص طلب الحالة
    checkForStatusRequest(messageText);

    // 🆕 تحقق من حالة الضيف قبل الإرسال (7 دقائق + 24h cooldown)
    if (sessionType === 'guest') {
      const {
        isTimeOver: timeOver,
        isCooldown: cooldown
      } = getGuestTimingState();

      // لو في cooldown (رفض سابق)
      if (cooldown) {
        const cooldownMsg: WebChatMessage = {
          from: 'bot',
          type: 'text',
          content: t('portal.chat.guest.cooldownLocked'),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, cooldownMsg]);
        setGuestLimitReached(true);
        openAuthModal();
        return;
      }

      // لو الوقت انتهى (7 دقائق) - أول مرة
      if (timeOver && !guestLimitReached) {
        const timeOverMsg: WebChatMessage = {
          from: 'bot',
          type: 'text',
          content: t('portal.chat.guest.timeLimitReached'),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, timeOverMsg]);
        setGuestLimitReached(true);
        markGuestHardLocked(); // تفعيل الـ 24h cooldown
        openAuthModal();
        return;
      }
    }

    const parsedTokenFilters = parseFilterTokensFromText(messageText);

    // ✅ Chat-First: تحديد finalParams تلقائياً حسب state (للحفاظ على العقد مع CRM)
    let finalParams = extraParams || {};
    if (state === 'awaiting_phone' && !extraParams?.event) {
      finalParams = {
        event: 'submit_phone',
        phone: messageText
      };
      console.log('[MalakChat] 📱 Auto-adding submit_phone event');
    } else if (state === 'awaiting_otp' && !extraParams?.event) {
      finalParams = {
        event: 'verify_otp',
        code: messageText
      };
      console.log('[MalakChat] 🔐 Auto-adding verify_otp event');
    }

    const mergedFilters = mergeClarifyFilters(
      sessionFilters,
      (extraParams?.filters as ClarifyFilters | undefined),
      parsedTokenFilters
    );

    if (hasFilters(mergedFilters)) {
      finalParams = {
        ...finalParams,
        filters: mergedFilters,
      };
      setSessionFilters(mergedFilters);
    }
    setError(null);

    // ✅ P0: Generate client_trace_id for end-to-end tracing
    const client_trace_id = createAndStoreCrmTraceId();
    console.log('[MalakChat] 🆔 Trace:', client_trace_id.slice(0, 8));

    // ✅ P0: Fast Router - for ACK message selection only (NO local reply)
    const route = fastRoute(messageText, language);
    console.log('[MalakChat] 🚀 Route:', route.type, '(all routes go to CRM)');

    // Add user message - use flushSync to force immediate UI update
    const userMsg: WebChatMessage = {
      from: 'user',
      type: 'text',
      content: messageText,
      timestamp: new Date()
    };

    // ✅ DSTOUR FIX: NO local greeting response - ALL messages go to CRM
    // Portal is pure proxy - CRM is the brain

    // ✅ P0: NO separate ACK message - unified thinking indicator handles it
    // Force immediate render: user message only
    flushSync(() => {
      setMessages(prev => [...prev, userMsg]);
      setInputValue('');
      setState('thinking'); // Unified indicator will show with smart text
    });

    // Track bot start on first message
    if (messages.length === 0) {
      telemetry.botStarted('chat');
    }
    try {
      const t0 = performance.now();

      // ✅ نمرر عدد الرسائل الحالية للتحكم في عرض البرامج
      const currentMessageCount = messages.length + 1; // +1 لرسالة المستخدم الجديدة

      const response = await sendMessage({
        text: messageText,
        visitor_id: visitorId,
        session_id: sessionId,
        web_user_id: webUserId,
        locale: 'ar',
        // 🆕 استخدام effectiveSessionType بدل sessionType
        session_type: effectiveSessionType,
        guest_session_id: guestSessionId || undefined,
        customer_id: customerId || undefined,
        student_portal_token: studentPortalToken || undefined,
        metadata: { search_mode: searchMode, client_trace_id }, // ✅ P0: Include trace_id
        deep_search: searchMode === 'deep', // 🆕 تمرير مباشر للـ hook
        ...finalParams
      }, currentMessageCount);
      
      console.log('[MalakChat] ✅ Response received:', { 
        trace_id: client_trace_id.slice(0, 8), 
        latency_ms: (performance.now() - t0).toFixed(0)
      });
      const latency = performance.now() - t0;

      // 🆕 Order #3: Normalize response using unified parser
      const normalized = normalizeCRMResponse(response);
      const rawResponse = response as any;
      const uiDirectives = rawResponse?.ui_directives ?? rawResponse?.uiDirectives ?? null;
      /* Clarify detection removed — bot handles clarification conversationally */
      
      // ✅ FIX: Log cardsQuery to debug trigger issues
      console.log('[MalakChat] 📦 Normalized response:', {
        messages: normalized.messages.length,
        universities: normalized.universities.length,
        cardsPlan: !!normalized.cardsPlan,
        cardsQuery: normalized.cardsQuery ? {
          query_id: normalized.cardsQuery.query_id,
          params: normalized.cardsQuery.params,
        } : null,
        events: normalized.events.length,
        state: normalized.state
      });
      
      // ✅ FIX: Also log raw response to verify cards_query passthrough
      if ((response as any).cards_query) {
        console.log('[MalakChat] 🔑 Raw cards_query from response:', (response as any).cards_query);
      }

      // ✅ Guard: Prevent rendering "empty" CRM messages (causes blank bubbles)
      const rawMsgCount = normalized.messages?.length || 0;
      const incomingMessages = (normalized.messages || []).filter((m: any) => {
        const text = String((m.reply_markdown ?? m.content ?? '')).trim();
        // Keep non-text message types even if content is empty (action/universities/etc.)
        if (m.type && m.type !== 'text') return true;
        if (m.action) return true;
        return text.length > 0;
      });

      if (import.meta.env.DEV && incomingMessages.length !== rawMsgCount) {
        console.warn('[MalakChat] 🧹 Dropped empty CRM messages', {
          trace_id: client_trace_id.slice(0, 8),
          dropped: rawMsgCount - incomingMessages.length,
        });
      }

      // ✅ When CRM returns empty reply, show a dynamic conversational fallback
      let effectiveMessages: (WebChatMessage & { isNew?: boolean })[];
      if (incomingMessages.length === 0 && isClarifyPayload(rawResponse || {})) {
        // CRM returned missing_fields with empty reply — generate dynamic prompt
        const missingFields: string[] = rawResponse?.missing_fields || [];
        const fieldLabels: Record<string, string> = {
          country_code: t('portal.chat.clarify.fields.country.label'),
          discipline_slug: t('portal.chat.clarify.fields.discipline_slug.label'),
          degree_slug: t('portal.chat.clarify.fields.degree_slug.label'),
          budget_max: t('botUi.fields.budget'),
          language: t('botUi.fields.language'),
        };
        const missingLabels = missingFields
          .map(f => fieldLabels[f])
          .filter(Boolean);
        
        let fallbackContent: string;
        if (missingLabels.length >= 2) {
          fallbackContent = t('botUi.clarifyMany', { fields: missingLabels.join(t('botUi.and')) });
        } else if (missingLabels.length === 1) {
          fallbackContent = t('botUi.clarifyOne', { field: missingLabels[0] });
        } else {
          fallbackContent = t('botUi.clarifyDefault');
        }
        
        effectiveMessages = [{
          from: 'bot',
          type: 'text',
          content: fallbackContent,
          timestamp: new Date(),
        }];
      } else if (shouldShowEmptyResponseFallback({
          payload: rawResponse || {},
          rawMessageCount: rawMsgCount,
          incomingMessageCount: incomingMessages.length,
        })) {
        effectiveMessages = [{
          from: 'bot',
          type: 'text',
          content: `${t('portal.chat.errors.emptyResponse')}\n\n📋 ${t('portal.chat.errors.traceCode')}: ${client_trace_id.slice(0, 8)}`,
          timestamp: new Date(),
        }];
      } else {
        effectiveMessages = incomingMessages as any;
      }

      // ✅ P0: Replace ACK message with real response OR add new messages
      if (effectiveMessages.length > 0) {
        const processedMessages = effectiveMessages.map((msg, idx) => {
          const isLast = idx === effectiveMessages.length - 1;

          // Default: no typing for older messages
          let isNew = false;

          // Typewriter only for the LAST bot message in this batch
          if (msg.from === 'bot' && isLast) isNew = true;

          if (msg.from === 'bot' && msg.content) {
            const localizedContent =
              typeof msg.content === 'string' && (
                msg.content.startsWith('search.') ||
                msg.content.startsWith('portal.chat.')
              )
                ? t(msg.content)
                : msg.content;

            msg = { ...msg, content: localizedContent } as any;

            // تخزين أول ترحيب
            if (messages.length === 0 && idx === 0 && !firstBotGreeting.current) {
              firstBotGreeting.current = msg.content.substring(0, 50);
              console.log('[MalakChat] 📝 Stored first greeting pattern:', firstBotGreeting.current);
            }
            // إزالة التكرار من الرسائل اللاحقة
            else if (firstBotGreeting.current && msg.content.startsWith(firstBotGreeting.current)) {
              console.log('[MalakChat] ✂️ Removing duplicate greeting from message');
              const cleanedContent = msg.content
                .replace(
                  new RegExp(
                    `^${firstBotGreeting.current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.!؟]*[.!؟]?\\s*`,
                    'i'
                  ),
                  ''
                )
                .trim();
              if (cleanedContent.length > 10) {
                return { ...msg, content: cleanedContent, isNew };
              }
            }
          }
          return { ...msg, isNew };
        });

        setMessages((prev) => {
          // ✅ P0: Remove ACK message (last bot message with isAck=true)
          const withoutAck = prev.filter((m, idx) => {
            // Keep if not the last message or not an ACK
            if (idx !== prev.length - 1) return true;
            return !(m as any).isAck;
          });

          // Remove isNew from old messages
          const oldMessages = withoutAck.map((m) => ({ ...m, isNew: false }));
          return [...oldMessages, ...processedMessages];
        });
      }

      const responsePhase = rawResponse?.phase ?? uiDirectives?.phase;
      const isHold = uiDirectives?.search_mode === 'hold' || responsePhase === 'clarify' || responsePhase === 'awaiting_consent';
      if (isHold) {
        setState(responsePhase === 'awaiting_consent' ? 'awaiting_consent' : 'idle');
        sendPortalEvent(PORTAL_EVENTS.REPLY_GUARD_BLOCKED, {
          timestamp: new Date().toISOString(),
          trace_id: client_trace_id,
        });
      } else {
        sendPortalEvent(PORTAL_EVENTS.REPLY_GUARD_PASSED, {
          timestamp: new Date().toISOString(),
          trace_id: client_trace_id,
        });
      }

      // ✅ عرض البرامج فقط عند السماح من CRM
      if (!isHold && normalized.universities.length > 0) {
        console.log(`[MalakChat] 📊 Universities received: ${normalized.universities.length}`);
        setUniversities(normalized.universities, true, normalized.cardsPlan);
      }
      
      // 🆕 Cards Pipeline: If CRM sent cards_query, fetch from Portal Catalog
      // ✅ T5 FIX: Gate search with shouldTriggerSearch() state machine
      const cq = normalized.cardsQuery;
      
      if (cq) {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 📋 EVIDENCE LOG: Print full CRM response keys when cards_query exists
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 [EVIDENCE] CRM Response Analysis (cards_query present)');
        console.log('   📦 Response top-level keys:', Object.keys(rawResponse || {}));
        console.log('   🔑 cards_query:', JSON.stringify(cq, null, 2));
        console.log('   🎛️ ui_directives (raw):', rawResponse?.ui_directives);
        console.log('   🎛️ uiDirectives (camelCase):', rawResponse?.uiDirectives);
        console.log('   🎛️ search_mode value:', uiDirectives?.search_mode ?? 'UNDEFINED');
        console.log('   📜 Full response (first 2000 chars):', 
          JSON.stringify(rawResponse, null, 2)?.slice(0, 2000)
        );
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const triggerCheck = validateSearchTrigger(uiDirectives as any, cq as any);
        const contractCheck = validateCardsQuery(cq as any);
        const shouldSearch = shouldTriggerSearch(cq, uiDirectives, false);

        if (!triggerCheck.canSearch || !shouldSearch) {
          console.log('[MalakChat] ⏸️ cards_query received but search trigger conditions not met');
          updateDebugInfo({
            last_trace_id: client_trace_id,
            last_cards_query: {
              query_id: cq.query_id || 'auto',
              params: cq.params,
            },
          });
          sendPortalEvent(PORTAL_EVENTS.SEARCH_BLOCKED_HOLD, {
            timestamp: new Date().toISOString(),
            trace_id: client_trace_id,
            query_id: cq.query_id,
            sequence: cq.sequence,
            filter_count: Object.keys(cq.params || {}).length,
          });
        } else if (!contractCheck.valid) {
          console.error('[MalakChat] 🔴 Contract violation. Blocking search.', contractCheck.violations);
          toast.error(t('portal.errors.contractViolationBody'));
          sendPortalEvent(PORTAL_EVENTS.CONTRACT_VIOLATION, {
            timestamp: new Date().toISOString(),
            trace_id: client_trace_id,
            violation_type: contractCheck.violations.map((v) => v.type).join(','),
          });
          sendPortalEvent(PORTAL_EVENTS.ACK_SKIPPED_CONTRACT, {
            timestamp: new Date().toISOString(),
            trace_id: client_trace_id,
            query_id: cq.query_id,
            sequence: cq.sequence,
          });
        } else {
          const cardsKey = JSON.stringify(cq);

          if (lastCardsKeyRef.current === cardsKey) {
            console.log('[MalakChat] 🧊 Skipping duplicate cards_query');
          } else {
            lastCardsKeyRef.current = cardsKey;

            cardsAbortRef.current?.abort();
            const ac = new AbortController();
            cardsAbortRef.current = ac;

            console.log('[MalakChat] 🔍 cards_query triggered (search_mode=start), fetching from Catalog:', cq);

            updateDebugInfo({
              last_trace_id: client_trace_id,
              last_cards_query: {
                query_id: cq.query_id || 'auto',
                params: cq.params,
              },
            });

            fetchCards(cq).then(async (result) => {
              if (ac.signal.aborted) {
                console.log('[MalakChat] ⏭️ Cards fetch aborted (newer request)');
                return;
              }

              const { programs, next_page_token, missing_fields, search_mode, blocked, blocked_reason, silent, messageKey } = result;

              if (search_mode === 'hold' || blocked || (missing_fields?.length || 0) > 0) {
                if (silent || blocked_reason === 'stale') {
                  return;
                }

                setState('searching');
                if (missing_fields && missing_fields.length > 0) {
                  sendPortalEvent(PORTAL_EVENTS.SEARCH_BLOCKED_HOLD, {
                    timestamp: new Date().toISOString(),
                    trace_id: client_trace_id,
                    query_id: cq.query_id,
                    sequence: cq.sequence,
                    filter_count: missing_fields.length,
                  });
                }

                const holdMessage: WebChatMessage = {
                  from: 'bot',
                  type: 'text',
                  content: t(messageKey || 'portal.chat.errors.needsMoreInfo'),
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, holdMessage]);
                return;
              }

              if (programs.length > 0) {
                console.log(`[MalakChat] 🎴 Fetched ${programs.length} programs from Catalog`);
                setUniversities(programs, true, normalized.cardsPlan, 'chat_cards');
                setNextPageToken(next_page_token ?? null);

                updateDebugInfo({
                  last_rendered_count: programs.length,
                  results_source: 'chat_cards',
                  last_api_total: programs.length,
                });
              } else {
                console.log('[MalakChat] 📭 No programs found for cards_query');
                clearChatResults();
                updateDebugInfo({
                  last_rendered_count: 0,
                  results_source: 'none',
                  last_api_total: 0,
                });
              }

              await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
              await sendACK({
                name: 'cards_rendered',
                ref: { query_id: cq.query_id, sequence: cq.sequence },
                success: true,
                metadata: { count: programs.length },
              });
            }).catch((err) => {
              if (err?.name === 'AbortError') return;
              console.error('[MalakChat] ❌ Cards fetch failed:', err);
              clearChatResults();
              updateDebugInfo({
                last_rendered_count: 0,
                results_source: 'none',
              });
            });
          }
        }
      }

      // 🆕 معالجة الأحداث (events) من CRM - Order #4
      if (normalized.events.length > 0) {
        console.log('[MalakChat] 📣 Events received:', normalized.events);
        executeResponseEvents(normalized.events);
      }

      // ✅ 3-Phase Workflow: Detect Consent/Clarify phase from CRM response
      const detectedConsent = detectConsentPhase(
        uiDirectives,
        rawResponse?.phase,
        rawResponse?.consent_status,
        rawResponse?.filters_hash
      );
      
      if (detectedConsent) {
        console.log('[MalakChat] 🔐 Consent phase detected:', detectedConsent);
        setConsentState(detectedConsent);
        if (detectedConsent.required) {
          setState('awaiting_consent');
        }
      } else {
        setConsentState(null);
      }

      // ✅ تحديد state بناء على need_name
      let newState = normalized.state;
      if (normalized.needName) {
        newState = 'awaiting_name';
      }
      // Don't override awaiting_consent if consent is required
      if (!detectedConsent?.required) {
        setState(newState);
      }

      // ✅ حفظ بيانات العميل في Context
      updateCustomerData({
        customer_id: normalized.customerId,
        normalized_phone: normalized.normalizedPhone,
        stage: normalized.stage,
        is_new_customer: normalized.isNewCustomer,
        student_portal_token: normalized.studentPortalToken,
        need_phone: normalized.needPhone,
        need_name: normalized.needName,
        stage_info: normalized.stageInfo ?? null
      });

      // 🆕 كشف حالة امتلاء الذاكرة للضيف
      if (normalized.guestState?.memory_full && stage !== 'authenticated' && !studentPortalToken) {
        console.log('[MalakChat] 🚫 Guest memory limit reached!');
        setGuestLimitReached(true);
      }

      // ✅ رسالة UX للعميل بعد التحقق مع token (حسابه الشخصي)
      if (normalized.stage === 'authenticated' && normalized.studentPortalToken && !customerId) {
        const content = normalized.isNewCustomer 
          ? t('portal.chat.messages.accountCreatedLinked')
          : t('portal.chat.messages.chatLinkedAccount');
        const welcomeMsg: WebChatMessage = {
          from: 'bot',
          type: 'text',
          content,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, welcomeMsg]);
        setTimeout(() => startTour(), 1500);
      }
      telemetry.botResultsShown(normalized.messages.length || 1, latency, 'chat');
    } catch (err: any) {
      console.error('[MalakChat] ❌ Error:', { trace_id: client_trace_id, error: err });
      
      // ✅ P0: Smart error message with trace_id
      const errorDetails = getSmartErrorMessage(err, t);
      setError(errorDetails.message);
      
      // 🆕 P0: Clear chat-driven results on error - Single Source of Truth
      clearChatResults();
      
      // 🆕 P0: Update debug info with error
      updateDebugInfo({
        last_trace_id: client_trace_id,
        results_source: 'none',
        last_rendered_count: 0
      });
      
      const errorMsg: WebChatMessage = {
        from: 'bot',
        type: 'text',
        content: `${errorDetails.message}\n\n📋 ${t('portal.chat.errors.traceCode')}: ${client_trace_id.slice(0, 8)}`,
        timestamp: new Date()
      };
      
      // ✅ P0: Remove ACK message and add error
      setMessages(prev => {
        const withoutAck = prev.filter((m, idx) => {
          if (idx !== prev.length - 1) return true;
          return !(m as any).isAck;
        });
        return [...withoutAck, errorMsg];
      });
      
      telemetry.botError('send_message', String(err));
      setState('idle');
    }
  }, [inputValue, state, messages.length, visitorId, sessionId, webUserId, sendMessage, setUniversities, updateCustomerData, customerId, telemetry, startTour, stage, studentPortalToken, guestLimitReached, getGuestTimingState, markGuestHardLocked, openAuthModal, sessionType, guestSessionId, searchMode, language, t, sessionFilters, threadKey]);

  useEffect(() => {
    if (!hasFilters(sessionFilters)) {
      sessionStorage.removeItem(getClarifyFiltersStorageKey(threadKey));
      return;
    }
    sessionStorage.setItem(getClarifyFiltersStorageKey(threadKey), JSON.stringify(sessionFilters));
  }, [sessionFilters, threadKey]);

  // 🆕 P5.3: Listen for compare-request-ready event from CompareDrawer
  useEffect(() => {
    const handleCompareRequest = (e: CustomEvent) => {
      const compareData = e.detail;
      if (!compareData?.event || compareData.event !== 'compare_request_v1') return;
      
      console.log('[MalakChat] 📥 Received compare_request_v1 from drawer:', compareData);
      
      // Auto-send the compare request as a message with event metadata
      handleSend(compareData.message, {
        event: compareData.event,
        metadata: compareData.metadata,
      });

      consumeQueuedCompareRequestPayload();
    };
    
    window.addEventListener('compare-request-ready', handleCompareRequest as EventListener);
    
    // Also check for pending request on mount (if chat was already open)
    const pending = consumeQueuedCompareRequestPayload();
    if (pending?.event === 'compare_request_v1') {
      console.log('[MalakChat] 📥 Found pending compare_request_v1:', pending);
      setTimeout(() => {
        handleSend(pending.message, {
          event: pending.event,
          metadata: pending.metadata,
        });
      }, 500); // Small delay to ensure chat is ready
    }
    
    return () => {
      window.removeEventListener('compare-request-ready', handleCompareRequest as EventListener);
    };
  }, [handleSend]);

  // 🤖 Auto-send greeting when navigated with ?ai_assist=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ai_assist') === '1') {
      // Remove the param to prevent re-triggering
      params.delete('ai_assist');
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
      
      // Auto-send greeting after a short delay
      setTimeout(() => {
        const greeting = language === 'ar' 
          ? 'مرحباً، أريد مساعدتك في إيجاد أفضل برنامج دراسي مناسب لي'
          : 'Hi, I need help finding the best study program for me';
        handleSend(greeting);
      }, 800);
    }
  }, []); // Run once on mount

  // 🆕 Handle pending message from ChatContext (e.g. ORX "Learn more")
  useEffect(() => {
    const pending = chatCtx?.consumePendingMessage?.();
    if (pending) {
      setTimeout(() => handleSend(pending), 500);
    }
  }, [chatCtx?.pendingMessage]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{
        program_ids: string[];
      }>;
      const programIds = custom.detail?.program_ids || [];
      console.log('[MalakChat] 🎯 Shortlist complete event received:', programIds);

      // 1) scroll للشات
      document.querySelector('[data-tour-id="tour-chat-box"]')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // 2) إرسال رسالة ملاك بعد delay قصير
      setTimeout(() => {
        handleSend(t('portal.chat.messages.shortlistComplete'), {
          event: 'shortlist_complete',
          metadata: {
            program_ids: programIds
          }
        });
      }, 500);
    };
    window.addEventListener('shortlist-complete', handler as EventListener);
    return () => window.removeEventListener('shortlist-complete', handler as EventListener);
  }, [handleSend]);

  // ✅ Chat-First: تم إزالة handlePhoneSubmit و handleOTPSubmit
  // المستخدم يكتب الرقم والـ OTP في textarea العادي
  // والـ handleSend يضيف الـ events تلقائياً حسب state

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
    setTimeout(() => handleSend(prompt), 100);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // منع الإرسال أثناء انتظار الرد أو إذا كان الضيف محظور
      if (state !== 'thinking' && state !== 'searching' && !isGuestLocked) {
        handleSend();
      }
    }
  };
  const handleClearHistory = () => {
    setMessages([]);
    setUniversities([], false);
    setState('idle');
    setError(null);
    clearAllHistory();
    clearHistory();
  };
  const handleLike = async (universityId: string) => {
    console.log('[MalakChat] User liked university:', universityId);
    telemetry.selectionSubmitted(1, 'chat');

    // Send like event to CRM
    await handleSend('', {
      event: 'like_university',
      metadata: {
        university_id: universityId,
        action: 'like'
      }
    });
  };
  const handleApply = async (universityId: string) => {
    console.log('[MalakChat] User applying to university:', universityId);

    // Send apply event to CRM
    await handleSend(t('portal.chat.messages.applyRequest'), {
      event: 'apply_university',
      metadata: {
        university_id: universityId,
        action: 'apply'
      }
    });
  };
  const handleRequestAlternatives = async () => {
    setUniversities([]);
    await handleSend(t('portal.chat.messages.requestAlternatives'));
  };

  // ✅ معالجة أزرار الأكشن في الرسائل
  const handleMessageAction = useCallback(async (action: string) => {
    console.log('[MalakChat] Action button clicked:', action);
    if (action === 'create_account' || action === 'confirm_account' || action === 'open_account') {
      // إرسال رسالة مع event لإنشاء الحساب
      await handleSend(t('portal.chat.messages.createAccount'), {
        event: 'create_account_confirmed',
        intent: 'create_account'
      });
    } else {
      // أي أكشن آخر
      await handleSend(t('portal.chat.messages.confirmAction'), {
        event: 'action_confirmed',
        action: action
      });
    }
  }, [handleSend]);
  
  // ✅ 3-Phase Workflow: Handle consent grant/decline
  // PORTAL-2: Use internal tokens, NOT Arabic text (prevents intent pollution)
  const handleConsent = useCallback(async (granted: boolean, filtersHash: string | null) => {
    console.log('[MalakChat] 🔐 Consent action:', granted ? 'granted' : 'declined', 'hash:', filtersHash?.slice(0, 8));
    setIsConsentLoading(true);
    
    try {
      // PORTAL-2: Send internal token + consent payload (CRM uses payload, not text)
      await handleSend(granted ? '__CONSENT_GRANTED__' : '__CONSENT_DECLINED__', {
        consent: {
          status: granted ? 'granted' : 'declined',
          filters_hash: filtersHash || undefined
        },
        event: granted ? 'consent_granted' : 'consent_declined'
      });
      
      // Clear consent state after sending
      setConsentState(null);
      setState('idle');
    } catch (err) {
      console.error('[MalakChat] ❌ Consent error:', err);
    } finally {
      setIsConsentLoading(false);
    }
  }, [handleSend]);
  
  const handleVoiceRecording = async () => {
    if (isRecording) {
      const transcribedText = await stopRecording();
      if (transcribedText) {
        setInputValue(transcribedText);
      }
    } else {
      await startRecording();
    }
  };

  // ✅ Input validation handler for phone/OTP modes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let value = e.target.value;

    // Phone mode: فقط أرقام و +
    if (inputMode === 'phone') {
      value = value.replace(/[^0-9+]/g, '');
    }
    // OTP mode: فقط أرقام (6 خانات كحد أقصى)
    else if (inputMode === 'otp') {
      value = value.replace(/[^0-9]/g, '').slice(0, 6);
    }
    setInputValue(value);
  };

  // ✅ Single Entry Point: Simple navigation logic - NO portal-verify calls here
  const handleOpenPortal = () => {
    // ✅ Check auth pending first
    const pendingUntil = sessionStorage.getItem('portal_auth_pending_until');
    if (pendingUntil && Date.now() < parseInt(pendingUntil, 10)) {
      console.log('[MalakChat] ✅ Auth pending, navigating to /account');
      navigate('/account');
      return;
    }
    
    // ✅ If has token → go to /account (exchange happens there ONLY)
    if (studentPortalToken) {
      console.log('[MalakChat] ✅ Token exists, navigating to /account');
      navigate('/account');
      return;
    }
    
    // ✅ For guest: open AuthModal
    console.log('[MalakChat] 👤 Guest user, opening AuthModal');
    openAuthModal();
  };

  // Unified design - variant-aware layout
  // ✅ Fixed: Chat container has max-height to prevent expansion with messages
  // ✅ WEB Command Pack v4: Added history sidebar

  useEffect(() => {
    (window as any).__portalEvidence = {
      q2: () => console.log('[Evidence Q2]', debugInfo),
      q3: () => console.log('[Evidence Q3]', { query: debugInfo.last_cards_query, trace: debugInfo.last_trace_id }),
      q4: () => console.log('[Evidence Q4]', { resultsSource: debugInfo.results_source, rendered: debugInfo.last_rendered_count }),
      q5: () => console.log('[Evidence Q5]', { nextPageToken }),
    };
  }, [debugInfo, nextPageToken]);

  const chatBoxClassName = cn(
    "flex flex-col overflow-hidden",
    isFullscreen
      ? "fixed inset-0 z-[9999] h-[100dvh] w-screen rounded-none bg-background border-0"
      : isFloating
        ? "h-full bg-card"
        : isInDeepSearch
          ? "bg-gradient-to-b from-background/95 to-muted/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl h-full min-h-[400px]"
            : compact
              ? (messages.length === 0 && state === 'idle'
                  ? "bg-[#1a1a1f]/90 backdrop-blur-xl rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                  : "bg-gradient-to-b from-background/95 to-muted/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl min-h-[593px] h-[77vh] max-h-[773px]")
              : "bg-gradient-to-b from-background/95 to-muted/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl min-h-[360px] h-[50vh] max-h-[520px]"
  );

  const chatBoxInner = (
    <div data-tour-id="tour-chat-box" className={chatBoxClassName}>
           {/* Header - Only in standalone mode */}
           {!isFloating && !(compact && messages.length === 0 && state === 'idle' && !isFullscreen) && (
             <div className={cn(
               "flex items-center justify-between border-b border-border bg-muted/30",
               isCompactMobileStandalone ? "px-3 py-2" : "px-6 py-3"
             )}>
                <div className="flex items-center gap-2">
                   <div className={cn(
                      "flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden bg-transparent",
                      isCompactMobileStandalone ? "w-8 h-8" : "w-10 h-10"
                    )}>
                      <img src={oryxaAvatar} alt="ORYXA" className="w-full h-full object-contain" />
                   </div>
                 <div>
                   <div className="flex items-center gap-2">
                     <h3 className={cn("font-semibold text-foreground", isCompactMobileStandalone ? "text-xs" : "text-sm")}>ORYXA</h3>
                   </div>
                   {customerId && stage === 'authenticated' && (
                     <span className={cn("font-medium text-green-600 dark:text-green-400", isCompactMobileStandalone ? "text-[9px]" : "text-[10px]")}>
                       {t('botUi.verified')}
                     </span>
                   )}
                 </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(v => !v)}
                  className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label={isFullscreen ? t('common.exitFullscreen', { defaultValue: 'Exit fullscreen' }) : t('common.fullscreen', { defaultValue: 'Fullscreen' })}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
             </div>
           )}


        {/* Messages Area - hidden in compact-empty state to keep box small (but always shown in fullscreen) */}
        {!(compact && messages.length === 0 && state === 'idle' && !isFullscreen) && (
        <div ref={scrollRef} onScroll={handleScroll} className={cn(
          "flex-1 overflow-y-auto min-h-0",
          isFullscreen && "w-full max-w-3xl mx-auto px-4",
          isFloating
            ? "px-2 py-2 space-y-3"
            : isCompactMobileStandalone
              ? "px-3 py-2 space-y-3"
              : "px-6 py-4 space-y-6"
        )}>
          {/* Welcome message - يظهر فقط إذا لم توجد رسائل وليس compact */}
          {messages.length === 0 && !compact && <div className={cn(
            "flex flex-col items-center justify-center h-full",
            isFloating
              ? "min-h-[80px] space-y-1"
              : isCompactMobileStandalone
                ? "min-h-[120px] space-y-2"
                : "min-h-[200px] space-y-4"
          )}>
              <div className={cn(
                "flex items-center justify-center overflow-visible",
                isFloating
                  ? "w-16 h-16"
                  : isCompactMobileStandalone
                    ? "w-24 h-24"
                    : "w-36 h-36"
              )}>
                <AnomalyOrb size={isFloating ? 64 : isCompactMobileStandalone ? 96 : 144} distortion={0.6} pulseSpeed={0.8} />
              </div>
              <div className={cn("text-center", isFloating ? "space-y-0.5" : isCompactMobileStandalone ? "space-y-1" : "space-y-2")}>
                <h2 className={cn("font-bold text-foreground", isFloating ? "text-xs" : isCompactMobileStandalone ? "text-base" : "text-2xl")}>
                  {t("bot.welcome")}
                </h2>
                <p className={cn("text-muted-foreground leading-relaxed", isFloating ? "text-[10px] max-w-[180px]" : isCompactMobileStandalone ? "text-xs max-w-[240px]" : "text-sm max-w-md")}>
                  {t("bot.intro")}
                </p>
              </div>
            </div>}
        
          {messages.map((msg, i) => <ChatMessage key={i} message={msg} onAction={handleMessageAction} isNew={msg.isNew} />)}

          {/* ✅ Unified Thinking Indicator - Smart ACK + dots in one bubble */}
          {(state === 'thinking' || state === 'searching') && (
            <div className={cn("flex animate-fade-in", isFloating ? "gap-2" : "gap-3")}>
              <div className={cn(
                "flex-shrink-0 rounded-full bg-muted border border-border flex items-center justify-center",
                isFloating ? "w-7 h-7" : "w-9 h-9"
              )}>
                <AIIcon className={cn("text-foreground", isFloating ? "w-3.5 h-3.5" : "w-5 h-5")} />
              </div>
              <div className={cn(
                "bg-muted rounded-2xl rounded-tl-none border border-border/50",
                isFloating ? "px-3 py-2 max-w-[200px]" : "px-5 py-3 max-w-[280px]"
              )}>
                {/* Smart ACK text */}
                <p className={cn("text-foreground mb-2", isFloating ? "text-xs" : "text-sm")}>
                  {state === 'searching' 
                    ? t("bot.searching_ack") || t('portal.chat.messages.searchingFallback')
                    : t("bot.thinking_ack") || t('portal.chat.messages.thinkingFallback')}
                </p>
                {/* Animated dots */}
                <div className="flex gap-1">
                  <div className={cn("rounded-full bg-primary animate-bounce", isFloating ? "w-1 h-1" : "w-1.5 h-1.5")} style={{ animationDelay: '0ms' }} />
                  <div className={cn("rounded-full bg-primary animate-bounce", isFloating ? "w-1 h-1" : "w-1.5 h-1.5")} style={{ animationDelay: '150ms' }} />
                  <div className={cn("rounded-full bg-primary animate-bounce", isFloating ? "w-1 h-1" : "w-1.5 h-1.5")} style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} id="chat_bottom" />
        </div>
        )}

        {/* Error alert */}
        {error && <div className="p-4 border-t border-border">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>}

        {/* ✅ شريط حالة الطالب - يظهر فقط بطلب من العميل */}
        {stage === 'authenticated' && stageInfo && showStatusBar && <div className="mx-6 mb-2 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">
                📌 {t('portal.chat.status.current')}: {stageInfo.student_substage_label || stageInfo.student_substage || t('portal.chat.status.unknown')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('portal.chat.status.docs')}: {stageInfo.docs_status || t('portal.chat.status.notUpdated')} · 
                {t('portal.chat.status.stage')}: {stageInfo.deal_stage_v2 || t('portal.chat.status.unknownFeminine')}
              </span>
            </div>
            {typeof stageInfo.progress_percent === 'number' && <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-primary">
                  {stageInfo.progress_percent}%
                </span>
                <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500" style={{
              width: `${Math.min(Math.max(stageInfo.progress_percent, 0), 100)}%`
            }} />
                </div>
              </div>}
          </div>}

        {/* ✅ 3-Phase Workflow: Consent Banner - PORTAL-1: Based on consentState.required ONLY */}
        {consentState?.required && (
          <ConsentBanner
            filtersHash={consentState.filters_hash}
            missingFields={consentState.missing_fields}
            holdReason={consentState.hold_reason}
            onConsent={handleConsent}
            isLoading={isConsentLoading}
          />
        )}

        {/* Clarify filters UI removed — search is conversational via bot only */}

        {/* Input area */}
        <div className={cn("flex-shrink-0", compact ? "px-3 pb-3 pt-3 bg-transparent border-0" : "border-t border-border", !compact && (isFloating ? "px-2 pb-1.5 pt-1 bg-background" : isCompactMobileStandalone ? "px-3 pb-3 pt-2 bg-muted/30" : "px-6 pb-6 pt-4 bg-muted/30"), isFullscreen && "w-full max-w-3xl mx-auto !px-4 !pb-8 !pt-3 bg-background border-t border-border")}
          style={isFloating ? { paddingBottom: 'max(6px, env(safe-area-inset-bottom, 6px))' } : isFullscreen ? { paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' } : undefined}
        >
          {/* الاقتراحات - فقط في البداية وليس compact */}
          {messages.length === 0 && !compact && state !== 'awaiting_phone' && state !== 'awaiting_otp' && <div className={cn("animate-fade-in", isFloating ? "mb-2" : "mb-3")}>
              <div className={cn("grid grid-cols-2 mx-auto", isFloating ? "gap-1.5 max-w-[320px]" : isCompactMobileStandalone ? "gap-2 max-w-[340px]" : "gap-2 max-w-2xl")}>
                {SUGGESTED_PROMPTS.map((prompt, i) => <button key={i} onClick={() => handlePromptClick(prompt)} disabled={state === 'thinking'} className={cn("inline-flex items-center font-medium rounded-lg border border-border bg-muted/80 hover:bg-muted hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed", isFloating ? "gap-1 px-1.5 py-1 text-[9px]" : isCompactMobileStandalone ? "gap-1.5 px-2 py-1.5 text-[11px]" : "gap-1.5 px-3 py-2 text-xs")}>
                    <Sparkles className={cn("text-blue-600 dark:text-blue-400 flex-shrink-0", isFloating ? "w-2.5 h-2.5" : isCompactMobileStandalone ? "w-3 h-3" : "w-3.5 h-3.5")} />
                    <span className="truncate text-foreground">{prompt}</span>
                  </button>)}
              </div>
            </div>}

          {/* ✅ CTA زر إنشاء الحساب - يظهر بعد التحقق مع token */}
          {studentPortalToken && stage === 'authenticated' && !ctaDismissed && <div className="mb-3 p-3 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-xl border border-green-500/20 animate-fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("chat.accountReady")}</p>
                    <p className="text-xs text-muted-foreground">{t("chat.followFileDesc")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleOpenPortal} className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white text-xs px-4">
                    {t("chat.followFile")}
                  </Button>
                  <button onClick={() => setCtaDismissed(true)} className="text-muted-foreground hover:text-foreground p-1" aria-label={t("chat.close")}>
                    ✕
                  </button>
                </div>
              </div>
            </div>}

          {/* 🆕 Guest Limit Banner - uses existing locale keys (12-language safe) */}
          {isGuestLocked && <div className="mb-3 rounded-xl border border-border bg-muted px-4 py-3 text-sm animate-fade-in">
              <p className="text-foreground mb-3 whitespace-pre-line font-medium">
                {isCooldown ? t("portal.chat.guest.cooldownLocked") : t("portal.chat.guest.timeLimitReached")}
              </p>
              <Button onClick={() => openAuthModal()} className="w-full bg-gradient-to-r from-primary to-blue-600 hover:opacity-90 text-white font-semibold">
                <User className="w-4 h-4 ml-2" />
                {t("cta.createFreeAccount")}
              </Button>
            </div>}

          {/* ⏸️ Countdown banner — hidden for super_admin */}
          {isChatPaused && (() => {
            const resumeDate = new Date('2026-04-21T00:00:00Z');
            const now = new Date();
            const diffMs = Math.max(0, resumeDate.getTime() - now.getTime());
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            return (
              <div className="flex items-center justify-center gap-2 py-2.5 px-4 mb-2 rounded-xl bg-muted border border-border text-muted-foreground text-sm font-medium">
                <span>{diffDays > 0 ? t('chatPause.countdown', { days: diffDays, hours: diffHours }) : t('chatPause.countdownShort', { days: 0 })}</span>
              </div>
            );
          })()}

          {/* ✅ Chat-First: textarea واحد دائماً - بدون PhoneInput/OTPInput منفصلة */}
          <div className="relative" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Rotating placeholder overlay - only when compact + empty + not focused-typing */}
            {compact && messages.length === 0 && !inputValue && !isChatPaused && (
              <div className={cn(
                "pointer-events-none absolute inset-y-0 flex items-start text-muted-foreground",
                isRTL ? "right-4 left-auto" : "left-4 right-auto",
                "top-3 sm:top-3.5 text-sm sm:text-base"
              )}>
                <TypewriterPlaceholder
                  phrases={[
                    t('home.hero.placeholders.0'),
                    t('home.hero.placeholders.1'),
                    t('home.hero.placeholders.2'),
                    t('home.hero.placeholders.3'),
                    t('home.hero.placeholders.4'),
                  ]}
                />
              </div>
            )}
            <Textarea 
              ref={textareaRef} 
              value={inputValue} 
              onChange={handleInputChange} 
              onKeyDown={handleKeyDown} 
              placeholder={
                compact && messages.length === 0
                  ? ''
                  : isChatPaused
                    ? t('chatPause.placeholder')
                    : (language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...')
              } 
              disabled={isChatPaused}
              className={cn(
                "resize-none rounded-3xl border shadow-sm outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground",
                compact && messages.length === 0 && state === 'idle'
                  ? "bg-transparent border-transparent text-white placeholder:text-white/40 shadow-none focus:border-transparent focus-visible:border-transparent"
                  : "bg-white dark:bg-zinc-800 border-border/50 text-foreground focus:border-border/50 focus-visible:border-border/50",
                isFloating 
                  ? "min-h-[40px] text-sm py-2.5 px-3.5 pb-10" 
                  : isCompactMobileStandalone
                    ? "min-h-[46px] py-2.5 px-3.5 pb-12 text-sm"
                    : "min-h-[52px] py-3 px-4 pb-14",
                isGuestLocked && "opacity-60 cursor-not-allowed"
              )}
              rows={1} 
              autoResize={true}
              maxHeight={isFloating ? 120 : 200}
            />
            
            {/* Bottom toolbar - ChatGPT style */}
            <div className={cn(
              "absolute bottom-2.5 flex items-center justify-between w-full px-3"
            )}>
              {/* Left side: + button and Extended thinking dropdown */}
              <div className="flex items-center gap-1">
                {/* Plus button */}
                {!isFloating && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                )}
                
                {/* Extended thinking / Deep search dropdown */}
                {!isFloating && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {searchMode === 'deep' ? (
                        <div className="flex items-center gap-0.5 bg-blue-50 dark:bg-blue-950/50 rounded-full pl-1 pr-2 py-1">
                          {/* X button to clear */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchMode('normal');
                            }}
                            className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 cursor-pointer">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">{t('portal.chat.controls.deepSearch')}</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 gap-1.5 text-sm rounded-full text-muted-foreground hover:text-foreground hover:bg-muted px-3"
                        >
                          <Clock className="w-4 h-4" />
                          <span>{t('portal.chat.controls.search')}</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align={isRTL ? "end" : "start"} 
                      className="min-w-[180px] rounded-xl p-1"
                    >
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1.5">
                        {t('portal.chat.controls.searchType')}
                      </DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={() => setSearchMode('normal')}
                        className="gap-3 rounded-lg cursor-pointer"
                      >
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1">{t('portal.chat.controls.search')}</span>
                        {searchMode === 'normal' && <Check className="w-4 h-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSearchMode('deep')}
                        className="gap-3 rounded-lg cursor-pointer"
                      >
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1">{t('portal.chat.controls.deepSearch')}</span>
                        {searchMode === 'deep' && <Check className="w-4 h-4" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Right side: Voice + Send buttons */}
              <div className="flex items-center gap-2.5">
                <Button 
                  type="button" 
                  size="icon" 
                  variant="ghost" 
                  onClick={handleVoiceRecording} 
                  disabled={state === 'thinking' || state === 'searching' || isRecording || isGuestLocked} 
                  title={t('portal.chat.controls.voice')}
                  aria-label={t('portal.chat.controls.voice')}
                  className={cn(
                    "rounded-full text-muted-foreground hover:text-foreground hover:bg-muted", 
                    isFloating ? "h-7 w-7" : "h-8 w-8", 
                    isRecording && "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 animate-pulse"
                  )}
                >
                  {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
                </Button>

                <div className="w-px h-5 bg-border/60" aria-hidden="true" />

                <Button 
                  type="button"
                  onClick={() => handleSend()} 
                  disabled={!inputValue.trim() || state === 'thinking' || state === 'searching' || isGuestLocked} 
                  size="icon" 
                  title={t('portal.chat.controls.sendWithEnter')}
                  aria-label={t('portal.chat.controls.send')}
                  className={cn(
                    "rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all", 
                    isFloating ? "h-7 w-7" : "h-9 w-9",
                    (!inputValue.trim() || state === 'thinking' || state === 'searching') && "opacity-30"
                  )}
                >
                  <ArrowUp className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
          </div>
        </div>
  );

  return (
    <div className={cn("flex", isFloating ? "flex-col h-full" : "flex-row w-full h-full gap-4")}>
      <div className={cn("flex-1 flex flex-col", (isFloating || isInDeepSearch) ? "h-full" : "")}>
        {isFullscreen ? createPortal(chatBoxInner, document.body) : chatBoxInner}

        {nextPageToken && lastCardsQuery && (
          <div className="px-3 py-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!nextPageToken) return;
                sendPortalEvent(PORTAL_EVENTS.PAGINATION_LOAD_MORE, { timestamp: new Date().toISOString() });
                const res = await fetchCards({ ...lastCardsQuery, page_token: nextPageToken });
                if (res.programs.length === 0) {
                  setNextPageToken(res.next_page_token ?? null);
                  return;
                }
                if (res.programs.length > 0) {
                  setUniversities([...(universities as any), ...(res.programs as any)], true, null, 'chat_cards');
                }
                setNextPageToken(res.next_page_token ?? null);
              }}
            >
              {t('portal.payments.more')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
