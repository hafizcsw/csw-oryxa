import { NavLink, useNavigate } from "react-router-dom";
import { Home, Compass, Film, Bell, MessageCircle, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSocialAuth } from "@/hooks/social/useSocialAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "./utils";

const items = [
  { to: "/social", icon: Home, label: "الرئيسية", end: true },
  { to: "/social/explore", icon: Compass, label: "استكشاف" },
  { to: "/social/reels", icon: Film, label: "ريلز" },
  { to: "/social/notifications", icon: Bell, label: "إشعارات" },
  { to: "/messages", icon: MessageCircle, label: "رسائل" },
];

export function SocialSidebar({ onCompose }: { onCompose: () => void }) {
  const { user, isAuthed } = useSocialAuth();
  const navigate = useNavigate();
  const meta: any = user?.user_metadata ?? {};

  return (
    <aside className="hidden md:flex flex-col w-[260px] shrink-0 sticky top-0 h-screen px-3 py-4 border-r border-[hsl(var(--social-border))] bg-[hsl(var(--social-bg))]">
      <div
        className="px-3 py-2 mb-2 text-2xl font-black tracking-tight cursor-pointer"
        onClick={() => navigate("/social")}
      >
        Oryxa<span className="text-[hsl(var(--social-accent))]">·</span>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex items-center gap-4 px-3 py-3 rounded-full text-[hsl(var(--social-text))] hover:bg-[hsl(var(--social-surface))] transition ${
                isActive ? "font-bold" : "font-normal"
              }`
            }
          >
            <it.icon className="w-6 h-6" />
            <span className="text-lg">{it.label}</span>
          </NavLink>
        ))}
        {isAuthed && (
          <NavLink
            to={`/social/u/${user?.id}`}
            className={({ isActive }) =>
              `flex items-center gap-4 px-3 py-3 rounded-full text-[hsl(var(--social-text))] hover:bg-[hsl(var(--social-surface))] transition ${
                isActive ? "font-bold" : "font-normal"
              }`
            }
          >
            <User className="w-6 h-6" />
            <span className="text-lg">الملف الشخصي</span>
          </NavLink>
        )}
      </nav>

      <Button
        onClick={onCompose}
        className="mt-4 rounded-full h-12 text-base font-bold bg-[hsl(var(--social-accent))] hover:bg-[hsl(var(--social-accent))]/90 text-white"
      >
        <Plus className="w-5 h-5 mr-1" />
        نشر
      </Button>

      <div className="mt-auto">
        {isAuthed ? (
          <div className="flex items-center gap-3 p-3 rounded-full hover:bg-[hsl(var(--social-surface))] cursor-pointer">
            <Avatar className="w-10 h-10">
              <AvatarImage src={meta.avatar_url} />
              <AvatarFallback>{initials(meta.full_name || user?.email)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate text-[hsl(var(--social-text))]">
                {meta.full_name || user?.email}
              </div>
              <div className="text-xs truncate text-[hsl(var(--social-muted))]">
                @{user?.email?.split("@")[0]}
              </div>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => navigate("/auth")}
            variant="outline"
            className="w-full rounded-full"
          >
            تسجيل الدخول
          </Button>
        )}
      </div>
    </aside>
  );
}
