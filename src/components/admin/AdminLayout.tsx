import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Home, LogOut, Menu, X } from "lucide-react";
import { verifyAdminSSOFromURL } from "@/lib/admin.sso";
import { AdminSidebar } from "./AdminSidebar";
import { AlertsBadge } from "./AlertsBadge";
import { cn } from "@/lib/utils";
import { AdminTopBar } from "./AdminTopBar";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t, language } = useLanguage();
  const isRTL = language === "ar";

  useEffect(() => {
    (async () => {
      const { ok, payload } = await verifyAdminSSOFromURL();
      if (!ok) {
        window.location.href = "/";
        return;
      }
      if (payload?.name) setName(payload.name);
    })();
  }, []);

  const handleSignOut = () => {
    sessionStorage.removeItem('csw_admin_sso');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      {/* Admin Top Bar */}
      <AdminTopBar />
      
      {/* Header - Full Width */}
      <header className="relative bg-gradient-to-r from-primary via-primary-glow to-accent dark:from-[hsl(222,25%,14%)] dark:via-[hsl(222,20%,18%)] dark:to-[hsl(222,15%,22%)] px-4 sm:px-6 py-1.5 sm:py-2 shadow-colored dark:shadow-none overflow-hidden">
        {/* Decorative circles */}
        <div className={`absolute -top-20 w-80 h-80 rounded-full bg-white/10 blur-3xl ${isRTL ? '-right-20' : '-left-20'}`}></div>
        <div className={`absolute -bottom-10 w-60 h-60 rounded-full bg-white/10 blur-2xl ${isRTL ? '-left-10' : '-right-10'}`}></div>
        
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-white hover:bg-white/20 h-8 w-8"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg leading-tight">
                {t('admin.dashboard')}
              </h1>
              {name && (
                <p className="text-white/90 text-[11px] sm:text-xs font-medium">
                  {t('admin.welcome')}، {name}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <AlertsBadge />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-1 sm:gap-2 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20 px-2 sm:px-3"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">{t('admin.home')}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-1 sm:gap-2 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20 px-2 sm:px-3"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t('admin.signOut')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Flex container for Sidebar and Content */}
      <div className="flex flex-1 min-h-0">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - responsive */}
        <div className={cn(
          "fixed lg:sticky lg:top-0 lg:self-stretch inset-y-0 z-50 transition-transform duration-300 lg:translate-x-0",
          isRTL ? "right-0" : "left-0",
          sidebarOpen 
            ? "translate-x-0" 
            : isRTL 
              ? "translate-x-full lg:translate-x-0" 
              : "-translate-x-full lg:translate-x-0"
        )}>
          <AdminSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-6 overflow-x-auto bg-muted/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
