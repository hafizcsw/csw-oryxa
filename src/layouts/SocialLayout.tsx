import { Outlet } from "react-router-dom";
import { useState } from "react";
import { SocialSidebar } from "@/components/social/SocialSidebar";
import { RightRail } from "@/components/social/RightRail";
import { MobileBottomNav } from "@/components/social/MobileBottomNav";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PostComposer } from "@/components/social/PostComposer";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export default function SocialLayout() {
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[hsl(var(--social-bg))] text-[hsl(var(--social-text))]">
      <div className="mx-auto flex max-w-[1280px]">
        <SocialSidebar onCompose={() => setComposeOpen(true)} />
        <main className="flex-1 min-w-0 border-x border-[hsl(var(--social-border))] min-h-screen pb-20 md:pb-0">
          <Outlet />
        </main>
        <RightRail />
      </div>

      <MobileBottomNav onCompose={() => setComposeOpen(true)} />

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-[hsl(var(--social-bg))] border-[hsl(var(--social-border))] max-w-xl p-0 [&>button]:text-[hsl(var(--social-text))]">
          <VisuallyHidden>
            <DialogTitle>منشور جديد</DialogTitle>
          </VisuallyHidden>
          <PostComposer onPosted={() => setComposeOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
