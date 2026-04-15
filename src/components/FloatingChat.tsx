import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useChat } from "@/contexts/ChatContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from 'react-i18next';
import { X, Sparkles } from 'lucide-react';

export default function FloatingChat() {
  const { pathname } = useLocation();
  const { isOpen, toggle, close } = useChat();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const shouldHide = isMobile && (pathname === '/' || pathname === '/index');
  const [isDragging, setIsDragging] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const [fabRect, setFabRect] = useState<DOMRect | null>(null);

  const updateFabRect = useCallback(() => {
    if (fabRef.current) setFabRect(fabRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    updateFabRect();
    window.addEventListener('resize', updateFabRect);
    return () => window.removeEventListener('resize', updateFabRect);
  }, [updateFabRect]);

  useEffect(() => {
    if (shouldHide && isOpen) close();
  }, [shouldHide, isOpen, close]);

  const getPopupStyle = () => {
    if (!fabRect) return { right: '16px', bottom: '80px' };
    const right = window.innerWidth - fabRect.right + fabRect.width + 8;
    const bottom = window.innerHeight - fabRect.top + 8;
    return { right: `${Math.max(8, right)}px`, bottom: `${Math.max(8, bottom)}px` };
  };

  return (
    <>
      {!shouldHide && (
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
            setTimeout(() => setIsDragging(false), 100);
          }}
          onClick={() => {
            if (isDragging) return;
            toggle();
          }}
          className="ai-fab"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" role="img" aria-hidden="true">
            <defs>
              <linearGradient id="gemini-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#4285F4', stopOpacity: 1 }} />
                <stop offset="33%" style={{ stopColor: '#9B72F2', stopOpacity: 1 }} />
                <stop offset="66%" style={{ stopColor: '#F538A0', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#FF9C27', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <path 
              fill="url(#gemini-gradient)" 
              d="M12 2L15.5 8.5L22 12L15.5 15.5L12 22L8.5 15.5L2 12L8.5 8.5L12 2Z"
            />
          </svg>
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && !shouldHide && (
          <motion.div
            key="chat-coming-soon"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed z-[9999] w-[340px] rounded-2xl shadow-2xl border border-border/60 bg-card overflow-hidden"
            style={getPopupStyle()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-gradient-to-r from-primary/5 to-accent/5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm text-foreground">ORYXA AI</span>
              </div>
              <button
                onClick={close}
                className="p-1 rounded-full hover:bg-muted/60 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Coming Soon Body */}
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary/60" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  {t('chat.comingSoon', 'قادم قريباً')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('chat.comingSoonDesc', 'نعمل على تطوير مساعد ORYXA الذكي. ترقبوا!')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
