/**
 * MessagesTab — Facebook Messenger-style "Chats" view inside the floating support panel.
 * Header (Chats + actions) → Search → Filter chips (All/Unread/Support) → Conversations list
 * → MiniChatWindow popup overlay when a thread is selected.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Search,
  MoreHorizontal,
  Maximize2,
  PenSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCommThreads, type CommThread } from "@/hooks/useCommApi";
import { SupportSubmitDialog } from "../SupportSubmitDialog";
import { MiniChatWindow } from "./MiniChatWindow";
import { cn } from "@/lib/utils";

interface MessagesTabProps {
  identityApproved: boolean;
  onOpenIdentity: () => void;
  onBack?: () => void;
}

type FilterKey = "all" | "unread" | "support";

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "•";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

export function MessagesTab({ identityApproved, onOpenIdentity, onBack }: MessagesTabProps) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isRtl = language === "ar";
  const { threads, loading, refresh } = useCommThreads();
  const [selected, setSelected] = useState<CommThread | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const sortedThreads = useMemo(
    () =>
      [...threads].sort(
        (a, b) =>
          new Date(b.last_message_at || b.created_at).getTime() -
          new Date(a.last_message_at || a.created_at).getTime(),
      ),
    [threads],
  );

  const visibleThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedThreads.filter((th) => {
      if (filter === "unread" && !(th.unread_count > 0)) return false;
      if (filter === "support" && th.thread_type !== "support") return false;
      if (!q) return true;
      const hay = `${th.display_name || ""} ${th.subject || ""} ${th.last_message_preview || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sortedThreads, search, filter]);

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("portal.support.panel.messages.filters.all", { defaultValue: "All" }) },
    { key: "unread", label: t("portal.support.panel.messages.filters.unread", { defaultValue: "Unread" }) },
    { key: "support", label: t("portal.support.panel.messages.filters.support", { defaultValue: "Support" }) },
  ];

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {onBack && (
        <div className="flex items-center px-3 py-2 border-b border-border/40 bg-card/40">
          <button
            type="button"
            onClick={onBack}
            className="h-8 px-2 inline-flex items-center gap-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-[12px]"
          >
            {isRtl ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
            {t("portal.support.panel.back", { defaultValue: "Back" })}
          </button>
        </div>
      )}

      {!identityApproved && (
        <button
          type="button"
          onClick={onOpenIdentity}
          className="mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 hover:bg-warning/15 transition-colors text-start"
        >
          <ShieldCheck className="h-4 w-4 text-warning flex-shrink-0" />
          <span className="text-[12px] text-foreground/90 leading-tight flex-1">
            {t("portal.support.panel.identityBanner", {
              defaultValue: "Verify your identity to unlock full messaging",
            })}
          </span>
          <ArrowRight className={cn("h-3.5 w-3.5 text-muted-foreground flex-shrink-0", isRtl && "rotate-180")} />
        </button>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-[17px] font-bold text-foreground tracking-tight">
          {t("portal.support.panel.messages.title", { defaultValue: "Chats" })}
        </h3>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
            aria-label={t("portal.support.panel.messages.menu", { defaultValue: "More" })}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/messages")}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
            aria-label={t("portal.support.panel.messages.expand", { defaultValue: "Open full" })}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
            aria-label={t("portal.support.panel.messages.newButton", { defaultValue: "New message" })}
          >
            <PenSquare className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 h-9 rounded-full bg-muted/60">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("portal.support.panel.messages.searchPlaceholder", {
              defaultValue: "Search Messenger",
            })}
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* ── Filter chips ── */}
      <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto [scrollbar-width:none]">
        {filterTabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "h-7 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors flex-shrink-0",
                active
                  ? "bg-primary/15 text-primary"
                  : "bg-muted/50 text-foreground/70 hover:bg-muted",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-2 [scrollbar-width:thin]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : visibleThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {search || filter !== "all"
                ? t("portal.support.panel.messages.empty.noResults", {
                    defaultValue: "No conversations match",
                  })
                : t("portal.support.panel.messages.empty.title", {
                    defaultValue: "No messages yet",
                  })}
            </p>
            {!search && filter === "all" && (
              <Button size="sm" className="mt-3" onClick={() => setNewOpen(true)}>
                {t("portal.support.panel.messages.empty.cta", {
                  defaultValue: "Start a conversation",
                })}
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5 py-1">
            {visibleThreads.map((th) => {
              const unread = th.unread_count > 0;
              const isActive = selected?.id === th.id;
              return (
                <li key={th.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(th)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors text-start",
                      isActive ? "bg-primary/10" : "hover:bg-muted/50",
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[12px] font-semibold text-primary">
                        {(th.display_name || th.subject || "?").charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-[13px] truncate",
                            unread ? "font-bold text-foreground" : "font-medium text-foreground/90",
                          )}
                        >
                          {th.display_name || th.subject}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "text-[11.5px] truncate mt-0.5",
                          unread ? "text-foreground/80 font-medium" : "text-muted-foreground",
                        )}
                      >
                        {th.last_message_preview || th.subject || ""}
                        <span className="mx-1 opacity-50">·</span>
                        <span>{relativeTime(th.last_message_at)}</span>
                      </p>
                    </div>
                    {unread && (
                      <span
                        className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0"
                        aria-label="unread"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="mt-auto shrink-0 border-t border-border/40 px-3 py-2 bg-card/40">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="w-full text-center text-[12px] text-primary hover:underline py-1 font-medium"
        >
          {t("portal.support.panel.messages.seeAll", {
            defaultValue: "See all in Messenger",
          })}
          {" →"}
        </button>
      </div>

      {/* ── Mini chat popup ── */}
      <AnimatePresence>
        {selected && (
          <MiniChatWindow
            key={selected.id}
            thread={selected}
            onClose={() => setSelected(null)}
            onMinimize={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <SupportSubmitDialog
        open={newOpen}
        onOpenChange={(o) => {
          setNewOpen(o);
          if (!o) refresh();
        }}
      />
    </div>
  );
}
