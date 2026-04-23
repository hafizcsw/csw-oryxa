/**
 * MessagesTab — Unified inbox over real messaging lanes (decision β).
 * Aggregates CRM support_cases + comm_threads with explicit source tags.
 * Opens each item in its native thread surface (no fake shells, no duplication).
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
  LifeBuoy,
  GraduationCap,
  School,
  Users,
  FileText,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUnifiedInbox, type InboxSource, type UnifiedInboxItem } from "@/hooks/useUnifiedInbox";
import { MiniChatWindow } from "./MiniChatWindow";
import { GetSupportView } from "./GetSupportView";
import { cn } from "@/lib/utils";

interface MessagesTabProps {
  identityApproved: boolean;
  onOpenIdentity: () => void;
  onBack?: () => void;
  initialThreadId?: string | null;
}

type FilterKey = "all" | "unread" | InboxSource;

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

const SOURCE_META: Record<InboxSource, { Icon: typeof LifeBuoy; tone: string }> = {
  support:     { Icon: LifeBuoy,      tone: "bg-primary/10 text-primary" },
  teacher:     { Icon: GraduationCap, tone: "bg-purple-500/10 text-purple-600 dark:text-purple-300" },
  university:  { Icon: School,        tone: "bg-blue-500/10 text-blue-600 dark:text-blue-300" },
  peer:        { Icon: Users,         tone: "bg-green-500/10 text-green-600 dark:text-green-300" },
  application: { Icon: FileText,      tone: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
  csw:         { Icon: Building2,     tone: "bg-muted text-foreground/70" },
  other:       { Icon: MessageSquare, tone: "bg-muted text-foreground/70" },
};

export function MessagesTab({ identityApproved, onOpenIdentity, onBack, initialThreadId = null }: MessagesTabProps) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isRtl = language === "ar";
  const { items, loading, refresh, openSupportCase } = useUnifiedInbox();
  const [selected, setSelected] = useState<UnifiedInboxItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingNewSupport, setPendingNewSupport] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const autoOpenedRef = useRef(false);

  // Auto-open the thread that triggered the launcher notification.
  useEffect(() => {
    if (!initialThreadId || autoOpenedRef.current) return;
    const match = items.find((i) => i.nativeId === initialThreadId);
    if (match) {
      setSelected(match);
      autoOpenedRef.current = true;
    }
  }, [initialThreadId, items]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === "unread" && !it.unread) return false;
      if (filter !== "all" && filter !== "unread" && it.source !== filter) return false;
      if (!q) return true;
      return `${it.title} ${it.preview}`.toLowerCase().includes(q);
    });
  }, [items, search, filter]);

  // After create, auto-open the new open support case as soon as it appears in the inbox.
  if (pendingNewSupport && openSupportCase) {
    setPendingNewSupport(false);
    setSelected(openSupportCase);
  }

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: "all",         label: t("portal.support.panel.messages.filters.all",         { defaultValue: "All" }) },
    { key: "unread",      label: t("portal.support.panel.messages.filters.unread",      { defaultValue: "Unread" }) },
    { key: "support",     label: t("portal.support.panel.messages.filters.support",     { defaultValue: "Support" }) },
    { key: "teacher",     label: t("portal.support.panel.messages.filters.teacher",     { defaultValue: "Teachers" }) },
    { key: "university",  label: t("portal.support.panel.messages.filters.university",  { defaultValue: "Universities" }) },
  ];

  // Step 5: open existing case if present, otherwise show create flow.
  // Closed cases are NEVER reused — only `openSupportCase` (status != closed) is opened.
  const handleNewSupport = () => {
    if (openSupportCase) {
      setSelected(openSupportCase);
      return;
    }
    setCreateOpen(true);
  };

  if (createOpen) {
    return (
      <GetSupportView
        onBack={() => setCreateOpen(false)}
        onSubmitted={() => {
          setCreateOpen(false);
          setPendingNewSupport(true);
          refresh();
        }}
      />
    );
  }

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

      {/* Header */}
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
            onClick={handleNewSupport}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
            aria-label={t("portal.support.panel.messages.newButton", { defaultValue: "New message" })}
          >
            <PenSquare className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
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

      {/* Filter chips */}
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

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 [scrollbar-width:thin]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {search || filter !== "all"
                ? t("portal.support.panel.messages.empty.noResults", { defaultValue: "No conversations match" })
                : t("portal.support.panel.messages.empty.title", { defaultValue: "No messages yet" })}
            </p>
            {!search && filter === "all" && (
              <Button size="sm" className="mt-3" onClick={handleNewSupport}>
                {t("portal.support.panel.messages.empty.cta", { defaultValue: "Start a conversation" })}
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5 py-1">
            {visibleItems.map((it) => {
              const meta = SOURCE_META[it.source];
              const Icon = meta.Icon;
              const isActive = selected?.key === it.key;
              return (
                <li key={it.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(it)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors text-start",
                      isActive ? "bg-primary/10" : "hover:bg-muted/50",
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center", meta.tone)}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-[13px] truncate",
                            it.unread ? "font-bold text-foreground" : "font-medium text-foreground/90",
                          )}
                        >
                          {it.title || t("portal.support.panel.messages.untitled", { defaultValue: "Conversation" })}
                        </p>
                        <span className="text-[10px] text-muted-foreground capitalize flex-shrink-0">
                          {t(`portal.support.panel.messages.source.${it.source}`, { defaultValue: it.source })}
                          {it.isClosed && (
                            <span className="ms-1 text-muted-foreground/70">
                              · {t("portal.support.panel.messages.closed", { defaultValue: "closed" })}
                            </span>
                          )}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-[11.5px] truncate mt-0.5",
                          it.unread ? "text-foreground/80 font-medium" : "text-muted-foreground",
                        )}
                      >
                        {it.preview}
                        <span className="mx-1 opacity-50">·</span>
                        <span>{relativeTime(it.timestamp)}</span>
                      </p>
                    </div>
                    {it.unread && (
                      <span className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" aria-label="unread" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto shrink-0 border-t border-border/40 px-3 py-2 bg-card/40">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="w-full text-center text-[12px] text-primary hover:underline py-1 font-medium"
        >
          {t("portal.support.panel.messages.seeAll", { defaultValue: "See all in Messenger" })}
          {" →"}
        </button>
      </div>

      {/* Mini chat popup — routes by source */}
      <AnimatePresence>
        {selected && (
          <MiniChatWindow
            key={selected.key}
            item={selected}
            onClose={() => {
              setSelected(null);
              refresh();
            }}
            onMinimize={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
