import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SocialSidebar } from "@/components/social/SocialSidebar";
import { RightRail } from "@/components/social/RightRail";
import { MobileBottomNav } from "@/components/social/MobileBottomNav";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PostComposer } from "@/components/social/PostComposer";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

/**
 * SocialLayout renders the full-viewport X+TikTok+Instagram experience.
 * It mounts via React Portal directly onto <body>, then hides every other
 * direct child of <body> (the rest of the app, headers, footers, floaters,
 * news ticker, MalakChat, PortalAuthFloater, etc.) so nothing bleeds through.
 * On unmount everything is restored.
 */
export default function SocialLayout() {
  const [composeOpen, setComposeOpen] = useState(false);
  const [hostReady, setHostReady] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  useEffect(() => {
    // 1. Build a dedicated host node attached to <body>
    const host = document.createElement("div");
    host.setAttribute("data-social-shell", "true");
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483600"; // above virtually anything
    document.body.appendChild(host);
    hostRef.current = host;

    // 2. Hide every OTHER direct child of body
    const restored: Array<{ el: HTMLElement; prev: string }> = [];
    Array.from(document.body.children).forEach((child) => {
      const el = child as HTMLElement;
      if (el === host) return;
      // Keep Radix/Sonner portal containers visible (they may host dialogs/toasts spawned from the shell)
      if (
        el.hasAttribute("data-radix-portal") ||
        el.hasAttribute("data-sonner-toaster") ||
        el.id === "radix-portal"
      ) {
        return;
      }
      restored.push({ el, prev: el.style.display });
      el.style.display = "none";
    });

    // 3. Lock background scroll & flag body
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.socialActive = "true";

    setHostReady(true);

    return () => {
      restored.forEach(({ el, prev }) => {
        el.style.display = prev;
      });
      document.body.style.overflow = prevOverflow;
      delete document.body.dataset.socialActive;
      if (host.parentNode) host.parentNode.removeChild(host);
      hostRef.current = null;
    };
  }, []);

  const isReels = location.pathname.startsWith("/social/reels");

  if (!hostReady || !hostRef.current) return null;

  const content = isReels ? (
    <div className="absolute inset-0 bg-black text-white overflow-hidden">
      <Outlet />
    </div>
  ) : (
    <div className="absolute inset-0 bg-[hsl(var(--social-bg))] text-[hsl(var(--social-text))] overflow-y-auto">
      <div className="mx-auto flex max-w-[1280px] min-h-full">
        <SocialSidebar onCompose={() => setComposeOpen(true)} />
        <main className="flex-1 min-w-0 border-x border-[hsl(var(--social-border))] min-h-screen pb-24 md:pb-0">
          <Outlet />
        </main>
        <RightRail />
      </div>

      <MobileBottomNav onCompose={() => setComposeOpen(true)} />

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-[hsl(var(--social-bg))] border-[hsl(var(--social-border))] max-w-xl p-0 [&>button]:text-[hsl(var(--social-text))]">
          <VisuallyHidden>
            <DialogTitle>منشور جديد</DialogTitle>
            <DialogDescription>اكتب منشوراً جديداً وأضف صوراً أو فيديو إن أردت.</DialogDescription>
          </VisuallyHidden>
          <PostComposer onPosted={() => setComposeOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );

  return createPortal(content, hostRef.current);
}
