/**
 * NavHintBadges - Floating notification hints for Currency & Shortlist
 * Dynamically positioned relative to actual DOM elements
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const HINT_DISMISSED_KEY = 'nav_hints_dismissed_v1';

function isHintDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissHints() {
  try {
    localStorage.setItem(HINT_DISMISSED_KEY, '1');
  } catch {}
}

function isProgramPage(pathname: string): boolean {
  return (
    pathname.includes('/universities') ||
    pathname.includes('/university/') ||
    pathname.includes('/program/') ||
    pathname.includes('/search')
  );
}

interface AnchorPos {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getAnchorPos(id: string): AnchorPos | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function NavHintBadges() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [showHints, setShowHints] = useState(false);
  const [currencyPos, setCurrencyPos] = useState<AnchorPos | null>(null);
  const [heartPos, setHeartPos] = useState<AnchorPos | null>(null);

  const updatePositions = useCallback(() => {
    setCurrencyPos(getAnchorPos('currency-selector-anchor'));
    setHeartPos(getAnchorPos('shortlist-heart-anchor'));
  }, []);

  useEffect(() => {
    if (isProgramPage(pathname) && !isHintDismissed()) {
      const timer = setTimeout(() => {
        updatePositions();
        setShowHints(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowHints(false);
    }
  }, [pathname, updatePositions]);

  // Update positions on resize/scroll
  useEffect(() => {
    if (!showHints) return;
    const handler = () => updatePositions();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [showHints, updatePositions]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!showHints) return;
    const timer = setTimeout(() => {
      setShowHints(false);
      dismissHints();
    }, 8000);
    return () => clearTimeout(timer);
  }, [showHints]);

  const handleDismiss = () => {
    setShowHints(false);
    dismissHints();
  };

  if (!showHints) return null;

  return (
    <AnimatePresence>
      {showHints && (
        <>
          {/* Currency Hint */}
          {currencyPos && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed z-[100] pointer-events-auto"
              style={{
                top: currencyPos.top + currencyPos.height + 8,
                left: currencyPos.left + currencyPos.width / 2,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="relative bg-primary text-primary-foreground text-xs font-medium px-3 py-2 rounded-lg shadow-lg max-w-[200px] whitespace-nowrap">
                <button onClick={handleDismiss} className="absolute -top-1.5 -end-1.5 bg-primary-foreground text-primary rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
                {/* Arrow pointing up */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rotate-45" />
                {isAr ? '💱 يمكنك تغيير العملة من هنا' : '💱 You can change currency here'}
              </div>
            </motion.div>
          )}

          {/* Shortlist Heart Hint */}
          {heartPos && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.3 }}
              className="fixed z-[100] pointer-events-auto"
              style={{
                top: heartPos.top + heartPos.height + 8,
                left: heartPos.left + heartPos.width / 2,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="relative bg-destructive text-destructive-foreground text-xs font-medium px-3 py-2 rounded-lg shadow-lg max-w-[220px] whitespace-nowrap">
                <button onClick={handleDismiss} className="absolute -top-1.5 -end-1.5 bg-destructive-foreground text-destructive rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
                {/* Arrow pointing up */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-destructive rotate-45" />
                {isAr ? '❤️ اضغط هنا لرؤية برامجك المفضلة' : '❤️ Click here to see your favorites'}
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
