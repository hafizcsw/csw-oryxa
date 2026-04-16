import { useCallback, useState } from "react";
import { CurrencySelector } from "@/components/CurrencySelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageDirection } from "@/i18n/languages";
import { useSwUpdateBadge } from "@/hooks/useSwUpdateBadge";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { idbDeleteDatabase } from "@/lib/spatialCache";

// Build ID for cache verification
const BUILD_ID = import.meta.env.VITE_BUILD_ID || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
export function GlobalTopBar() {
  const { t, language } = useLanguage();
  const direction = getLanguageDirection(language);
  const hasUpdate = useSwUpdateBadge();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const forceRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    // Show toast immediately
    toast.info(t("admin.clearingCache"));
    try {
      // 1) Unregister ALL service workers aggressively
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          // Send skip waiting message if there's a waiting worker
          if (reg.waiting) {
            reg.waiting.postMessage({
              type: 'SKIP_WAITING'
            });
          }
          await reg.unregister();
        }
      }

      // 2) Clear ALL CacheStorage
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }

      // 3) Clear sessionStorage, localStorage cache keys, and IndexedDB spatial cache
      try {
        sessionStorage.clear();
        // Only clear cache-related localStorage items
        const keysToRemove = Object.keys(localStorage).filter(k => k.includes('cache') || k.includes('sw') || k.includes('workbox'));
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {
        console.warn("[ForceRefresh] storage clear failed:", e);
      }
      // Clear IndexedDB spatial cache (fire-and-forget)
      try { await idbDeleteDatabase(); } catch { /* best effort */ }
    } catch (e) {
      console.warn("[ForceRefresh] soft-failed:", e);
    }

    // 4) Longer delay to ensure all cache operations complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // 5) Force hard reload bypassing cache
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("_nocache", String(Date.now()));
    url.searchParams.set("_v", BUILD_ID);

    // Use replace and add cache-control headers via fetch first
    try {
      await fetch(url.toString(), {
        cache: 'reload'
      });
    } catch (e) {
      // Ignore fetch errors
    }
    window.location.replace(url.toString());
  }, [isRefreshing]);
  return (
    <div className="bg-secondary text-secondary-foreground" dir={direction}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1 sm:py-1.5 flex items-center justify-end gap-3 text-xs">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={forceRefresh} disabled={isRefreshing} className="relative flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50" aria-label={t("admin.instantUpdate")}>
                  
                  {hasUpdate && !isRefreshing && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ring-2 ring-[#1a252f]" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("admin.instantUpdate")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div id="currency-selector-anchor">
            <CurrencySelector />
          </div>
        </div>
      </div>
    </div>
  );
}