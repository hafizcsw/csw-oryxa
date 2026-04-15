import { useState } from "react";
import { Bell } from "lucide-react";
import { useStudentNotifications } from "@/hooks/useStudentNotifications";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface NotificationsBellProps {
  userId?: string;
}

export function NotificationsBell({ userId }: NotificationsBellProps) {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const {
    notifications,
    unreadCount,
    loading,
    error,
    featureAvailable,
    markAllSeen,
  } = useStudentNotifications(userId);
  const [open, setOpen] = useState(false);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (value && unreadCount > 0) {
      markAllSeen();
    }
  };

  const mapEventTypeToTitle = (eventType: string): string => {
    switch (eventType) {
      case "stage_changed":
      case "stage_change":
        return t("notifications.stageChanged");
      case "document_status_changed":
      case "document_verified":
        return t("notifications.documentUpdated");
      case "document_rejected":
        return t("notifications.documentRejected");
      case "payment_status_changed":
      case "payment_confirmed":
        return t("notifications.paymentUpdated");
      case "note_added":
      case "note_public":
        return t("notifications.noteAdded");
      default:
        return t("notifications.newUpdate");
    }
  };

  const getEventIcon = (eventType: string): string => {
    switch (eventType) {
      case "stage_changed":
      case "stage_change":
        return "🔄";
      case "document_verified":
        return "✅";
      case "document_rejected":
        return "❌";
      case "document_status_changed":
        return "📄";
      case "payment_status_changed":
      case "payment_confirmed":
        return "💰";
      case "note_added":
      case "note_public":
        return "💬";
      default:
        return "📌";
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background hover:bg-muted transition-colors"
          aria-label={t("notifications.title")}
        >
          <Bell className="h-4 w-4 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end" dir={isRTL ? "rtl" : "ltr"}>
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-foreground">{t("notifications.title")}</span>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {unreadCount} {t("notifications.new")}
            </span>
          )}
        </div>

        {!featureAvailable ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {t("notifications.disabled")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.contactCounselor")}
            </p>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              {t("notifications.noNew")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.willNotify")}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y divide-border">
              {notifications.slice(0, 10).map((n) => (
                <li
                  key={n.id}
                  className="px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">
                      {getEventIcon(n.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-sm text-foreground truncate">
                          {n.title || mapEventTypeToTitle(n.type)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                          {n.message}
                        </p>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString(language === 'ar' ? "ar-SA" : "en-US", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllSeen}
            >
              {t("notifications.markAllRead")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
