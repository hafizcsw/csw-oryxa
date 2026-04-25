import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { SocialSidebar } from "@/components/social/SocialSidebar";
import { RightRail } from "@/components/social/RightRail";
import { MobileBottomNav } from "@/components/social/MobileBottomNav";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PostComposer } from "@/components/social/PostComposer";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export default function SocialLayout() {
  const [composeOpen, setComposeOpen] = useState(false);
  const location = useLocation();

  // Mark body so global floaters / chat widgets can opt-out via CSS if needed
  useEffect(() => {
    document.body.dataset.socialActive = "true";
    return () => {
      delete document.body.dataset.socialActive;
    };
  }, []);

  // Reels uses full viewport — no sidebar/rail
  const isReels = location.pathname.startsWith("/social/reels");

  if (isReels) {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-[hsl(var(--social-bg))] text-[hsl(var(--social-text))] overflow-y-auto">
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
}
