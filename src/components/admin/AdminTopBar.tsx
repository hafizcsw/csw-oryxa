import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSwUpdateBadge } from "@/hooks/useSwUpdateBadge";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const BUILD_ID = import.meta.env.VITE_BUILD_ID || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

export function AdminTopBar() {
  const { t, language } = useLanguage();
  const hasUpdate = useSwUpdateBadge();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const forceRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    toast.info(t("admin.clearingCache"));
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await reg.unregister();
        }
      }

      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }

      try {
        sessionStorage.clear();
        const keysToRemove = Object.keys(localStorage).filter(k => 
          k.includes('cache') || k.includes('sw') || k.includes('workbox')
        );
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {
        console.warn("[ForceRefresh] storage clear failed:", e);
      }
    } catch (e) {
      console.warn("[ForceRefresh] soft-failed:", e);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("_nocache", String(Date.now()));
    url.searchParams.set("_v", BUILD_ID);

    try {
      await fetch(url.toString(), { cache: 'reload' });
    } catch (e) {
      // Ignore fetch errors
    }
    window.location.replace(url.toString());
  }, [isRefreshing]);

  return (
    <div className="bg-gradient-to-r from-primary/90 via-primary-glow/80 to-accent/70 dark:from-[hsl(222,25%,12%)] dark:via-[hsl(222,20%,15%)] dark:to-[hsl(222,15%,18%)] text-white dark:text-foreground" dir="ltr">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center justify-end gap-3 text-xs">
        <Link to="/social" className="hover:text-white/80 transition-colors">{t("nav.community")}</Link>
        <Link to="/blog" className="hover:text-white/80 transition-colors">{t("nav.news")}</Link>
        <Link to="/events" className="hover:text-white/80 transition-colors">{t("nav.events")}</Link>
        <Link to="/where-we-are" className="hover:text-white/80 transition-colors">{t("nav.findUs")}</Link>
        
        <div className="flex items-center gap-2 border-s border-white/20 ps-4">
          <span className="text-[10px] text-white/60 font-mono hidden sm:inline">
            v{BUILD_ID.slice(-6)}
          </span>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={forceRefresh} 
                  disabled={isRefreshing} 
                  className="relative flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50" 
                  aria-label={t("admin.instantUpdate")}
                >
                  {hasUpdate && !isRefreshing && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ring-2 ring-primary" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("admin.instantUpdate")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}
