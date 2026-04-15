import { useState, useEffect } from "react";

/**
 * Hook to detect available Service Worker updates
 * Uses registration.waiting + updatefound + statechange (NOT controllerchange)
 */
export function useSwUpdateBadge() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      // 1) If there's already a waiting SW => update available immediately
      if (reg.waiting) setHasUpdate(true);

      // 2) Listen for new updates
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;

        installing.addEventListener("statechange", () => {
          // installed + old controller exists => update available
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setHasUpdate(true);
          }
        });
      });
    });
  }, []);

  return hasUpdate;
}
