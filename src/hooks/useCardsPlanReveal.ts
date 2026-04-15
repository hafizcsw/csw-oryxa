/**
 * Sequential Cards Reveal Hook
 * يتحكم في عرض الكروت تدريجياً حسب cards_plan من CRM
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface CardsPlanV1 {
  mode: 'sequential' | 'instant';
  show_loader_first_ms?: number;  // مدة عرض الـ loader قبل البدء (افتراضي: 900)
  pace_ms?: number;               // وقت بين كل كرت والتالي (افتراضي: 750)
  max_cards?: number;             // الحد الأقصى للعرض التلقائي (افتراضي: 8)
  typing_lines?: string[];        // رسائل تظهر أثناء التحميل
  allow_show_all?: boolean;       // السماح بزر "اعرض الكل الآن" (افتراضي: true)
}

interface UseCardsPlanRevealOptions<T> {
  cards: T[];
  plan?: CardsPlanV1 | null;
  fallbackDisplayCount?: number;  // عدد الكروت الافتراضي بدون plan
}

interface UseCardsPlanRevealResult<T> {
  visibleCards: T[];
  isRevealing: boolean;
  isLoading: boolean;
  currentTypingLine: string | null;
  progress: number;              // 0-100
  showAllNow: () => void;
  hasMore: boolean;
  totalCards: number;
}

export function useCardsPlanReveal<T>({
  cards,
  plan,
  fallbackDisplayCount = 6
}: UseCardsPlanRevealOptions<T>): UseCardsPlanRevealResult<T> {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [currentTypingLine, setCurrentTypingLine] = useState<string | null>(null);
  
  // Refs for cleanup
  const loaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // ✅ Fix #2A
  const cardsKeyRef = useRef<string>('');
  
  // Generate unique key for cards array to detect new data
  const cardsKey = cards.map(c => (c as any).id || JSON.stringify(c)).join('|');
  
  // Cleanup function - ✅ Fix #2A: includes typingIntervalRef
  const cleanup = useCallback(() => {
    if (loaderTimerRef.current) {
      clearTimeout(loaderTimerRef.current);
      loaderTimerRef.current = null;
    }
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  }, []);
  
  // Show all immediately
  const showAllNow = useCallback(() => {
    cleanup();
    setIsLoading(false);
    setIsRevealing(false);
    setCurrentTypingLine(null);
    setVisibleCount(cards.length);
  }, [cards.length, cleanup]);
  
  // Effect for manual display count updates (More button)
  useEffect(() => {
    if (!plan || plan.mode !== 'sequential') {
      setVisibleCount(Math.min(cards.length, fallbackDisplayCount));
    }
  }, [fallbackDisplayCount, cards.length, plan]);
  
  // Main effect: start reveal sequence when cards change
  useEffect(() => {
    // Skip if same cards
    if (cardsKey === cardsKeyRef.current) return;
    cardsKeyRef.current = cardsKey;
    
    // Cleanup previous timers
    cleanup();
    
    // No cards = reset
    if (cards.length === 0) {
      setVisibleCount(0);
      setIsLoading(false);
      setIsRevealing(false);
      setCurrentTypingLine(null);
      return;
    }
    
    // No plan or instant mode = show all immediately (fallback)
    if (!plan || plan.mode !== 'sequential') {
      setVisibleCount(Math.min(cards.length, fallbackDisplayCount));
      return;
    }
    
    // Sequential mode: start the reveal process
    const {
      show_loader_first_ms = 900,
      pace_ms = 750,
      max_cards = 8,
      typing_lines = [],
    } = plan;
    
    const targetCount = Math.min(cards.length, max_cards);
    
    // Phase 1: Show loader
    setIsLoading(true);
    setVisibleCount(0);
    
    // Show typing lines if available - ✅ Fix #2A: store interval in ref
    if (typing_lines.length > 0) {
      setCurrentTypingLine(typing_lines[0]);
      
      // Cycle through typing lines during loader phase
      let lineIndex = 0;
      typingIntervalRef.current = setInterval(() => {
        lineIndex = (lineIndex + 1) % typing_lines.length;
        setCurrentTypingLine(typing_lines[lineIndex]);
      }, show_loader_first_ms / Math.max(typing_lines.length, 1));
      
      loaderTimerRef.current = setTimeout(() => {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        startReveal();
      }, show_loader_first_ms);
    } else {
      loaderTimerRef.current = setTimeout(startReveal, show_loader_first_ms);
    }
    
    function startReveal() {
      setIsLoading(false);
      setIsRevealing(true);
      setCurrentTypingLine(null);
      
      let currentCount = 0;
      
      // Reveal first card immediately
      currentCount = 1;
      setVisibleCount(1);
      
      // Reveal remaining cards with interval
      if (targetCount > 1) {
        revealTimerRef.current = setInterval(() => {
          currentCount++;
          setVisibleCount(currentCount);
          
          if (currentCount >= targetCount) {
            cleanup();
            setIsRevealing(false);
          }
        }, pace_ms);
      } else {
        setIsRevealing(false);
      }
    }
    
    return cleanup;
  }, [cardsKey, plan, cards.length, fallbackDisplayCount, cleanup]);
  
  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);
  
  const maxCards = plan?.max_cards || fallbackDisplayCount;
  const targetCount = Math.min(cards.length, maxCards);
  const progress = targetCount > 0 ? Math.round((visibleCount / targetCount) * 100) : 0;
  
  return {
    visibleCards: cards.slice(0, visibleCount),
    isRevealing,
    isLoading,
    currentTypingLine,
    progress,
    showAllNow,
    hasMore: visibleCount < cards.length,
    totalCards: cards.length
  };
}
