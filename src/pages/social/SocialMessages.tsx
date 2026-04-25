import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Phone, Video, Info, Smile, Image as ImageIcon, Heart, ArrowLeft, PenSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocialAuth } from "@/hooks/social/useSocialAuth";
import { initials } from "@/components/social/utils";

interface Thread {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  lastMessage: string;
  time: string;
  unread?: boolean;
  active?: boolean;
}

interface Msg {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
}

// Demo data — to be wired to Supabase later
const DEMO_THREADS: Thread[] = [
  { id: "1", name: "سارة أحمد", handle: "sara_a", lastMessage: "أكيد، أرسلي لي الرابط 🌟", time: "2د", unread: true, active: true },
  { id: "2", name: "محمد خالد", handle: "m_khaled", lastMessage: "تمام، نتفق غداً", time: "1س" },
  { id: "3", name: "نور الهدى", handle: "nour", lastMessage: "تم الإرسال ✅", time: "3س" },
  { id: "4", name: "Oryxa Support", handle: "oryxa", lastMessage: "مرحباً بك في Oryxa Social!", time: "أمس" },
  { id: "5", name: "ليلى محمود", handle: "laila_m", lastMessage: "شكراً جزيلاً لكِ 🙏", time: "2ي" },
];

const DEMO_MESSAGES: Record<string, Msg[]> = {
  "1": [
    { id: "m1", fromMe: false, text: "هلا! شفتِ منشوري الجديد؟", time: "10:14" },
    { id: "m2", fromMe: true, text: "إيه شفته، حلو جداً 😍", time: "10:15" },
    { id: "m3", fromMe: false, text: "أكيد، أرسلي لي الرابط 🌟", time: "10:16" },
  ],
};

export default function SocialMessages() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthed } = useSocialAuth();
  const meta: any = user?.user_metadata ?? {};
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  const activeId = threadId ?? null;
  const activeThread = DEMO_THREADS.find((t) => t.id === activeId);
  const messages = activeId ? DEMO_MESSAGES[activeId] ?? [] : [];

  const filtered = DEMO_THREADS.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.handle.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = () => {
    if (!draft.trim()) return;
    // TODO: wire to backend
    setDraft("");
  };

  return (
    <div className="flex h-screen w-full bg-[hsl(var(--social-bg))] text-[hsl(var(--social-text))]">
      {/* Threads list */}
      <aside
        className={cn(
          "flex flex-col border-l border-[hsl(var(--social-border))] w-full md:w-[360px] shrink-0",
          activeId && "hidden md:flex"
        )}
      >
        <div className="px-5 py-4 border-b border-[hsl(var(--social-border))] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate">
              {isAuthed ? meta.full_name || user?.email?.split("@")[0] : "الرسائل"}
            </h1>
          </div>
          <Button variant="ghost" size="icon" aria-label="رسالة جديدة">
            <PenSquare className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--social-muted))]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث"
              className="pr-9 bg-[hsl(var(--social-surface))] border-0 rounded-full h-10"
            />
          </div>
        </div>

        <div className="px-5 pt-2 pb-1 flex items-center justify-between">
          <span className="text-sm font-bold">الرسائل</span>
          <button className="text-xs text-[hsl(var(--social-muted))] hover:text-[hsl(var(--social-text))]">
            طلبات
          </button>
        </div>

        <ScrollArea className="flex-1">
          <ul className="px-2 pb-4">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => navigate(`/social/messages/${t.id}`)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-right transition",
                    activeId === t.id
                      ? "bg-[hsl(var(--social-surface))]"
                      : "hover:bg-[hsl(var(--social-surface))]/60"
                  )}
                >
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={t.avatar} />
                    <AvatarFallback>{initials(t.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">{t.name}</span>
                      <span className="text-xs text-[hsl(var(--social-muted))] shrink-0">
                        {t.time}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "text-sm truncate",
                        t.unread
                          ? "text-[hsl(var(--social-text))] font-semibold"
                          : "text-[hsl(var(--social-muted))]"
                      )}
                    >
                      {t.lastMessage}
                    </div>
                  </div>
                  {t.unread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--social-accent))] shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </aside>

      {/* Conversation */}
      <section
        className={cn(
          "flex-1 flex flex-col border-l border-[hsl(var(--social-border))]",
          !activeId && "hidden md:flex"
        )}
      >
        {!activeThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-24 h-24 rounded-full border-2 border-[hsl(var(--social-text))] flex items-center justify-center mb-5">
              <Send className="w-10 h-10 -rotate-12" />
            </div>
            <h2 className="text-2xl font-light mb-2">رسائلك</h2>
            <p className="text-[hsl(var(--social-muted))] mb-6">
              أرسل صوراً ورسائل خاصة إلى صديق أو مجموعة.
            </p>
            <Button className="rounded-lg bg-[hsl(var(--social-accent))] hover:bg-[hsl(var(--social-accent))]/90 text-white">
              إرسال رسالة
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--social-border))]">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => navigate("/social/messages")}
                  aria-label="رجوع"
                >
                  <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                </Button>
                <Avatar className="w-9 h-9">
                  <AvatarImage src={activeThread.avatar} />
                  <AvatarFallback>{initials(activeThread.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{activeThread.name}</div>
                  <div className="text-xs text-[hsl(var(--social-muted))]">
                    {activeThread.active ? "نشط الآن" : "غير متصل"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="مكالمة">
                  <Phone className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="فيديو">
                  <Video className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="معلومات">
                  <Info className="w-5 h-5" />
                </Button>
              </div>
            </header>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="flex flex-col gap-2 max-w-2xl mx-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      m.fromMe ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "px-4 py-2 rounded-3xl max-w-[75%] text-sm",
                        m.fromMe
                          ? "bg-[hsl(var(--social-accent))] text-white"
                          : "bg-[hsl(var(--social-surface))] text-[hsl(var(--social-text))]"
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center text-sm text-[hsl(var(--social-muted))] py-10">
                    ابدأ المحادثة 👋
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Composer */}
            <div className="px-4 py-3 border-t border-[hsl(var(--social-border))]">
              <div className="flex items-center gap-2 bg-[hsl(var(--social-surface))] rounded-full px-3 py-1.5 max-w-2xl mx-auto">
                <Button variant="ghost" size="icon" className="shrink-0" aria-label="إيموجي">
                  <Smile className="w-5 h-5" />
                </Button>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="اكتب رسالة..."
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
                />
                {draft.trim() ? (
                  <Button
                    onClick={handleSend}
                    variant="ghost"
                    size="sm"
                    className="text-[hsl(var(--social-accent))] font-bold shrink-0"
                  >
                    إرسال
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="icon" className="shrink-0" aria-label="صورة">
                      <ImageIcon className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0" aria-label="إعجاب">
                      <Heart className="w-5 h-5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
