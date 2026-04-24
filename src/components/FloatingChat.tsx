import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useChat } from "@/contexts/ChatContext";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { track } from "@/lib/analytics";
import { MalakChatInterface } from "./chat/MalakChatInterface";
import { ChatSessionsSidebar, ChatSessionItem } from "./chat/ChatSessionsSidebar";
import { EnhancedChatHeader } from "./chat/EnhancedChatHeader";
import { useChatSize } from "@/hooks/useChatSize";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export default function FloatingChat() {
  const { pathname } = useLocation();
  const { isOpen, toggle, close } = useChat();
  const { 
    messages, 
    sessionId, 
    clearHistory,
  } = useMalakChat();
  
  // ORYXA V2: Chat size management
  const { sizeMode, cycleSize, isFullscreen, getSizeStyle } = useChatSize();
  const isMobile = useIsMobile();
  const shouldHideFloatingFab = isMobile && (pathname === '/' || pathname === '/index');
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSessionItem[]>([]);
  const [fabRect, setFabRect] = useState<DOMRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);

  // حساب موقع الشات بناءً على موقع الزر - ملتصق به مباشرة
  const getChatStyle = useCallback(() => {
    if (!fabRect) {
      return { right: '16px', bottom: '80px', sidebarOnRight: false };
    }

    const chatWidth = 380;
    const chatHeight = 520;
    const gap = 8;
    const fabCenterX = fabRect.left + fabRect.width / 2;
    const screenMidX = window.innerWidth / 2;

    const isOnRight = fabCenterX > screenMidX;

    let left: number | undefined;
    let right: number | undefined;
    let bottom: number;

    if (isOnRight) {
      right = window.innerWidth - fabRect.right + fabRect.width + gap;
    } else {
      left = fabRect.left + fabRect.width + gap;
    }

    bottom = window.innerHeight - fabRect.top + gap;

    if (right !== undefined && right + chatWidth > window.innerWidth - 8) {
      right = 8;
    }
    if (left !== undefined && left + chatWidth > window.innerWidth - 8) {
      left = undefined;
      right = 8;
    }
    if (left !== undefined && left < 8) {
      left = 8;
    }

    if (bottom + chatHeight > window.innerHeight - 8) {
      bottom = window.innerHeight - chatHeight - 8;
    }
    if (bottom < 8) {
      bottom = 8;
    }

    // حساب إذا كان الـ Sidebar يجب أن يظهر على اليمين
    // إذا الشات على يسار الشاشة (left محدد)، الـ Sidebar على اليمين
    const sidebarOnRight = left !== undefined && left < 200;

    return {
      left: left !== undefined ? `${left}px` : undefined,
      right: right !== undefined ? `${right}px` : undefined,
      bottom: `${bottom}px`,
      sidebarOnRight
    };
  }, [fabRect]);

  // تحديث موقع الزر عند التحميل وعند تغيير الحجم
  const updateFabRect = useCallback(() => {
    if (fabRef.current) {
      setFabRect(fabRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    updateFabRect();
    window.addEventListener('resize', updateFabRect);
    return () => window.removeEventListener('resize', updateFabRect);
  }, [updateFabRect]);

  // Load sessions from localStorage on mount
  const loadSessions = useCallback(() => {
    const stored = localStorage.getItem('malak_chat_sessions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setChatSessions(parsed);
      } catch {
        setChatSessions([]);
      }
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Save current session when messages change
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;

    const userMessages = messages.filter(m => m.from === 'user');
    const preview = userMessages[0]?.content || '';
    
    setChatSessions(prev => {
      const existing = prev.find(s => s.id === sessionId);
      let updated: ChatSessionItem[];
      
      if (existing) {
        // Update existing session
        updated = prev.map(s => 
          s.id === sessionId 
            ? { ...s, preview: preview || s.preview }
            : s
        );
      } else {
        // Add new session
        const newSession: ChatSessionItem = {
          id: sessionId,
          created_at: new Date().toISOString(),
          preview,
        };
        updated = [newSession, ...prev];
      }
      
      // Keep only last 20 sessions
      updated = updated.slice(0, 20);
      localStorage.setItem('malak_chat_sessions', JSON.stringify(updated));
      return updated;
    });
  }, [sessionId, messages]);

  const handleNewChat = () => {
    clearHistory();
    setSidebarOpen(false);
  };

  const handleSelectSession = (selectedSessionId: string) => {
    if (selectedSessionId === sessionId) {
      setSidebarOpen(false);
      return;
    }
    
    // Load messages for selected session from localStorage
    const stored = localStorage.getItem(`malak_session_${selectedSessionId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Update current session in context
        localStorage.setItem('malak_session_id', selectedSessionId);
        localStorage.setItem('malak_chat_history', JSON.stringify(parsed));
        // Reload page to apply changes (simple approach)
        window.location.reload();
      } catch {
        console.warn('Failed to load session:', selectedSessionId);
      }
    }
    setSidebarOpen(false);
  };

  const handleDeleteSession = (deleteSessionId: string) => {
    setChatSessions(prev => {
      const updated = prev.filter(s => s.id !== deleteSessionId);
      localStorage.setItem('malak_chat_sessions', JSON.stringify(updated));
      localStorage.removeItem(`malak_session_${deleteSessionId}`);
      return updated;
    });
  };

  // Save messages for current session
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`malak_session_${sessionId}`, JSON.stringify({
        messages,
        universities: [],
      }));
    }
  }, [sessionId, messages]);

  useEffect(() => {
    if (shouldHideFloatingFab && isOpen) {
      close();
    }
  }, [shouldHideFloatingFab, isOpen, close]);

  return (
    <>
      
      {!shouldHideFloatingFab && (
        <motion.button
          ref={fabRef}
          aria-label="AI Assistant"
          drag="x"
          dragConstraints={{ left: -window.innerWidth + 72, right: 0 }}
          dragElastic={0.1}
          whileDrag={{ scale: 1.1 }}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => {
            updateFabRect();
            // تأخير صغير للتفريق بين السحب والنقر
            setTimeout(() => setIsDragging(false), 100);
          }}
          onClick={() => {
            if (isDragging) return; // تجاهل النقر إذا كان سحب
            toggle();
            if (!isOpen) {
              track("assistant_opened", { source: "floating_button" });
            }
          }}
          className="ai-fab"
        >
          <svg width="26" height="26" viewBox="0 0 32 32" role="img" aria-hidden="true" fill="none">
            {/* Antigravity-style apex mark — minimal, editorial */}
            <path
              d="M16 4 L28 27 L21.5 27 L16 16 L10.5 27 L4 27 Z"
              fill="currentColor"
            />
            <circle cx="16" cy="9.5" r="1.6" fill="currentColor" />
          </svg>
        </motion.button>
      )}

      {/* نافذة الدردشة */}
      <AnimatePresence>
        {isOpen && !shouldHideFloatingFab && (() => {
          const chatStyle = getChatStyle();
          const sizeStyle = getSizeStyle();
          
          return (
            <motion.div
              key="chat-window"
              initial={isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.9, y: 20 }}
              animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.9, y: 20 }}
              transition={isMobile 
                ? { type: 'spring', stiffness: 300, damping: 30 }
                : { type: 'spring', stiffness: 400, damping: 30 }
              }
              className={cn(
                "oryxa-chat",
                isFullscreen ? "oryxa-fullscreen" : "ai-chat-wrapper",
                isMobile && "oryxa-mobile-fullscreen"
              )}
              style={(isFullscreen || isMobile) ? {
                position: 'fixed' as const,
                inset: 0,
                width: '100vw',
                height: '100dvh',
                zIndex: 9999,
              } : { 
                left: chatStyle.left, 
                right: chatStyle.right, 
                bottom: chatStyle.bottom,
                ...sizeStyle
              }}
            >
              {/* Sidebar ينزلق للخارج — مخفي على الموبايل */}
              {sidebarOpen && !isFullscreen && !isMobile && (
                <div className={`ai-chat__external-sidebar ${chatStyle.sidebarOnRight ? 'ai-chat__external-sidebar--right' : ''}`}>
                  <ChatSessionsSidebar
                    sessions={chatSessions}
                    currentSessionId={sessionId}
                    onSelectSession={handleSelectSession}
                    onNewChat={handleNewChat}
                    onDeleteSession={handleDeleteSession}
                  />
                </div>
              )}

              <div className={cn(
                "flex flex-col h-full",
                (isFullscreen || isMobile) ? "rounded-none" : "ai-chat rounded-2xl shadow-2xl"
              )}>
                {/* Enhanced Header */}
                <EnhancedChatHeader
                  onClose={close}
                  onNewChat={handleNewChat}
                  onToggleHistory={isMobile ? undefined : () => setSidebarOpen(!sidebarOpen)}
                  historyOpen={sidebarOpen}
                  sizeMode={sizeMode}
                  onCycleSize={isMobile ? undefined : cycleSize}
                  isFullscreen={isFullscreen || isMobile}
                />

                {/* Chat Body */}
                <div className={cn(
                  "flex-1 overflow-hidden",
                  (isFullscreen || isMobile) ? "bg-background" : "ai-chat__body"
                )}>
                  <MalakChatInterface variant="floating" />
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
}
