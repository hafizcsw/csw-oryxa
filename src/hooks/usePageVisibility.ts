import { useState, useEffect, useCallback } from "react";

/**
 * Hook to track page visibility state
 * Returns true if page is visible, false if hidden
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => {
    // SSR safety check
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Hook for smart interval that pauses when page is hidden
 * @param callback - Function to call on each interval
 * @param activeDelay - Interval in ms when page is visible
 * @param hiddenDelay - Interval in ms when page is hidden (0 = paused)
 */
export function useSmartInterval(
  callback: () => void,
  activeDelay: number,
  hiddenDelay: number = 0
): void {
  const isVisible = usePageVisibility();
  
  useEffect(() => {
    const delay = isVisible ? activeDelay : hiddenDelay;
    
    // If delay is 0, don't set up interval (paused)
    if (delay === 0) return;
    
    // Call immediately on mount/visibility change
    callback();
    
    const interval = setInterval(callback, delay);
    
    return () => clearInterval(interval);
  }, [callback, activeDelay, hiddenDelay, isVisible]);
}

/**
 * Hook for countdown timer that pauses when page is hidden
 * @param targetDate - Target date for countdown
 * @param onTick - Called on each tick with remaining seconds
 */
export function useSmartCountdown(
  targetDate: Date | string | null,
  onTick: (secondsRemaining: number, isExpired: boolean) => void
): void {
  const isVisible = usePageVisibility();
  
  const calculate = useCallback(() => {
    if (!targetDate) {
      onTick(0, true);
      return;
    }
    
    const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
    const now = new Date();
    const diffSeconds = Math.floor((target.getTime() - now.getTime()) / 1000);
    
    if (diffSeconds <= 0) {
      onTick(0, true);
    } else {
      onTick(diffSeconds, false);
    }
  }, [targetDate, onTick]);
  
  useEffect(() => {
    // Calculate immediately
    calculate();
    
    // If hidden, don't update
    if (!isVisible) return;
    
    const interval = setInterval(calculate, 1000);
    
    return () => clearInterval(interval);
  }, [calculate, isVisible]);
}
