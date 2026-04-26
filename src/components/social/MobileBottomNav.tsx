import { NavLink } from "react-router-dom";
import { Home, Compass, Film, Bell, MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileBottomNav({ onCompose }: { onCompose: () => void }) {
  const items = [
    { to: "/social", icon: Home, end: true },
    { to: "/social/explore", icon: Compass },
    { to: "/social/reels", icon: Film },
    { to: "/social/notifications", icon: Bell },
    { to: "/social/messages", icon: MessageCircle },
  ];
  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 bg-[hsl(var(--social-bg))]/95 backdrop-blur border-t border-[hsl(var(--social-border))]">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex items-center justify-center py-3 ${
                isActive ? "text-[hsl(var(--social-accent))]" : "text-[hsl(var(--social-text))]"
              }`
            }
          >
            <it.icon className="w-6 h-6" />
          </NavLink>
        ))}
      </nav>
      <Button
        onClick={onCompose}
        size="icon"
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[hsl(var(--social-accent))] hover:bg-[hsl(var(--social-accent))]/90 shadow-lg"
        aria-label="نشر"
      >
        <Plus className="w-6 h-6 text-white" />
      </Button>
    </>
  );
}
