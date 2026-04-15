import { useEffect, useRef, useCallback, useState } from 'react';

interface UseAutoScrollNextTabOptions {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabOrder: string[];
  enabled?: boolean;
  /** Threshold from bottom (px) to trigger next tab */
  threshold?: number;
  /** Cooldown in ms after tab change before allowing another */
  cooldown?: number;
}

export function useAutoScrollNextTab({
  activeTab,
  setActiveTab,
  tabOrder,
  enabled = true,
  threshold = 100,
  cooldown = 1500,
}: UseAutoScrollNextTabOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastChangeTime = useRef<number>(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToNextTab = useCallback(() => {
    const now = Date.now();
    if (now - lastChangeTime.current < cooldown) return;
    
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex === -1 || currentIndex >= tabOrder.length - 1) return;
    
    const nextTab = tabOrder[currentIndex + 1];
    lastChangeTime.current = now;
    setIsTransitioning(true);
    
    // Smooth transition effect
    setTimeout(() => {
      setActiveTab(nextTab);
      // Scroll to top of new tab
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setTimeout(() => setIsTransitioning(false), 300);
    }, 150);
  }, [activeTab, setActiveTab, tabOrder, cooldown]);

  const goToPrevTab = useCallback(() => {
    const now = Date.now();
    if (now - lastChangeTime.current < cooldown) return;
    
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex <= 0) return;
    
    const prevTab = tabOrder[currentIndex - 1];
    lastChangeTime.current = now;
    setIsTransitioning(true);
    
    setTimeout(() => {
      setActiveTab(prevTab);
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
      setTimeout(() => setIsTransitioning(false), 300);
    }, 150);
  }, [activeTab, setActiveTab, tabOrder, cooldown]);

  useEffect(() => {
    if (!enabled || !scrollRef.current) return;
    
    const element = scrollRef.current;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      
      ticking = true;
      requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = element;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const distanceFromTop = scrollTop;
        
        // At bottom → go to next tab
        if (distanceFromBottom < threshold && distanceFromBottom >= 0) {
          goToNextTab();
        }
        // At top → go to previous tab (optional, comment out if not wanted)
        // else if (distanceFromTop < threshold && distanceFromTop >= 0) {
        //   goToPrevTab();
        // }
        
        ticking = false;
      });
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [enabled, threshold, goToNextTab, goToPrevTab]);

  // Reset transition when tab changes
  useEffect(() => {
    lastChangeTime.current = Date.now();
  }, [activeTab]);

  return {
    scrollRef,
    isTransitioning,
    goToNextTab,
    goToPrevTab,
  };
}
