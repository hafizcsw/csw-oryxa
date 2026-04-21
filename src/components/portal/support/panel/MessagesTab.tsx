import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowRight, Loader2, MessageSquare, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCommThreads, type CommThread } from "@/hooks/useCommApi";
import { CommThreadView } from "@/components/comm/CommThreadView";
import { SupportSubmitDialog } from "../SupportSubmitDialog";
import { cn } from "@/lib/utils";

interface MessagesTabProps {
  identityApproved: boolean;
  onOpenIdentity: () => void;
  onBack?: () => void;
}

function relativeTime(iso: string | null, locale: string): string {
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

  const sortedThreads = useMemo(
    () =>
      [...threads].sort(
        (a, b) =>
          new Date(b.last_message_at || b.created_at).getTime() -
          new Date(a.last_message_at || a.created_at).getTime(),
      ),
    [threads],
  );

  // ── Thread view ──
  if (selected) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-card/40">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("portal.support.panel.messages.back", { defaultValue: "Back" })}
          >
            {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {selected.subject || selected.display_name || t("portal.support.panel.title")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/messages`)}
            className="text-[11px] text-primary hover:underline"
          >
            {t("portal.support.panel.messages.viewFullThread", {
              defaultValue: "Open full",
            })}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <CommThreadView
            threadId={selected.id}
            threadType={selected.thread_type}
            subject={selected.subject || undefined}
            className="h-full"
          />
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="flex flex-col h-full min-h-0">
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

      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("portal.support.panel.tabs.messages", { defaultValue: "Messages" })}
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setNewOpen(true)}
          className="h-7 text-xs gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("portal.support.panel.messages.newButton", { defaultValue: "New" })}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 [scrollbar-width:thin]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : sortedThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {t("portal.support.panel.messages.empty.title", {
                defaultValue: "No messages yet",
              })}
            </p>
            <Button size="sm" className="mt-3" onClick={() => setNewOpen(true)}>
              {t("portal.support.panel.messages.empty.cta", {
                defaultValue: "Start a conversation",
              })}
            </Button>
          </div>
        ) : (
          <ul className="space-y-0.5 py-1">
            {sortedThreads.map((th) => (
              <li key={th.id}>
                <button
                  type="button"
                  onClick={() => setSelected(th)}
                  className="w-full flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-start"
                >
                  <div className="relative mt-0.5">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary">
                      {(th.display_name || "?").charAt(0).toUpperCase()}
                    </div>
                    {th.unread_count > 0 && (
                      <span className="absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        "text-[13px] truncate",
                        th.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90",
                      )}>
                        {th.subject || th.display_name}
                      </p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {relativeTime(th.last_message_at, language)}
                      </span>
                    </div>
                    {th.last_message_preview && (
                      <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                        {th.last_message_preview}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-3 border-t border-border/40">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="w-full text-center text-[12px] text-primary hover:underline py-1"
        >
          {t("portal.support.panel.messages.openFullPage", {
            defaultValue: "Open Messages page",
          })}
          {" →"}
        </button>
      </div>

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
