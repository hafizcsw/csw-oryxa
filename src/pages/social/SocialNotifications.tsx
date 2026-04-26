import { useState } from "react";
import { Heart, MessageCircle, UserPlus, AtSign, Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/components/social/utils";

type NotifType = "like" | "comment" | "follow" | "mention";
interface Notif {
  id: string;
  type: NotifType;
  from: string;
  text: string;
  time: string;
  unread?: boolean;
}

const DEMO: Notif[] = [
  { id: "1", type: "like", from: "سارة أحمد", text: "أعجبها منشورك", time: "5د", unread: true },
  { id: "2", type: "follow", from: "محمد خالد", text: "بدأ بمتابعتك", time: "20د", unread: true },
  { id: "3", type: "comment", from: "نور الهدى", text: "علّقت: رائع! 🎉", time: "1س" },
  { id: "4", type: "mention", from: "ليلى محمود", text: "أشارت إليك في تعليق", time: "3س" },
  { id: "5", type: "like", from: "Oryxa Team", text: "أعجبهم تعليقك", time: "أمس" },
];

const ICONS = {
  like: { Icon: Heart, color: "text-[hsl(var(--social-like))]" },
  comment: { Icon: MessageCircle, color: "text-[hsl(var(--social-accent))]" },
  follow: { Icon: UserPlus, color: "text-emerald-500" },
  mention: { Icon: AtSign, color: "text-purple-500" },
};

const TABS = [
  { key: "all", label: "الكل" },
  { key: "mentions", label: "إشارات" },
  { key: "follows", label: "متابعات" },
] as const;

export default function SocialNotifications() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");

  const filtered = DEMO.filter((n) => {
    if (tab === "mentions") return n.type === "mention";
    if (tab === "follows") return n.type === "follow";
    return true;
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-[hsl(var(--social-bg))]/85 backdrop-blur border-b border-[hsl(var(--social-border))]">
        <div className="px-5 py-4 flex items-center gap-3">
          <Bell className="w-6 h-6" />
          <h1 className="text-xl font-black">الإشعارات</h1>
        </div>
        <div className="grid grid-cols-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "py-3 text-sm font-bold transition",
                tab === t.key
                  ? "text-[hsl(var(--social-text))] border-b-2 border-[hsl(var(--social-accent))]"
                  : "text-[hsl(var(--social-muted))] hover:bg-[hsl(var(--social-surface))]/50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-3 text-[hsl(var(--social-muted))]" />
          <p className="text-sm text-[hsl(var(--social-muted))]">لا إشعارات بعد.</p>
        </div>
      ) : (
        <ul>
          {filtered.map((n) => {
            const { Icon, color } = ICONS[n.type];
            return (
              <li
                key={n.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-4 border-b border-[hsl(var(--social-border))] hover:bg-[hsl(var(--social-surface))]/50 transition cursor-pointer",
                  n.unread && "bg-[hsl(var(--social-accent))]/5"
                )}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback>{initials(n.from)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-[hsl(var(--social-bg))] border-2 border-[hsl(var(--social-bg))] flex items-center justify-center">
                    <Icon className={cn("w-4 h-4", color)} fill={n.type === "like" ? "currentColor" : "none"} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-bold">{n.from}</span>{" "}
                    <span className="text-[hsl(var(--social-muted))]">{n.text}</span>
                  </div>
                  <div className="text-xs text-[hsl(var(--social-muted))] mt-0.5">{n.time}</div>
                </div>
                {n.unread && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--social-accent))] shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
