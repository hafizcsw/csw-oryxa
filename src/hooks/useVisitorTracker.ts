/**
 * Visitor Tracker Hook
 * Tracks page views via decisionTracking (single source of truth).
 * Also tracks SPA navigation automatically via pushState/replaceState interception.
 */

import { useEffect, useRef } from "react";
import { trackPageView } from "@/lib/decisionTracking";

export function useVisitorTracker() {
  const lastPath = useRef<string>("");
  const initialized = useRef<boolean>(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const sendPageView = () => {
      const currentPath = window.location.pathname;
      if (lastPath.current === currentPath) return;
      lastPath.current = currentPath;
      trackPageView();
    };

    // Initial page view
    sendPageView();

    // Track navigation changes (SPA)
    const handlePopState = () => sendPageView();
    window.addEventListener("popstate", handlePopState);

    // Override pushState to track programmatic navigation
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      sendPageView();
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      sendPageView();
      return result;
    };

    return () => {
      window.removeEventListener("popstate", handlePopState);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);
}
