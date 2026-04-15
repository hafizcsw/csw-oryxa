// src/components/chat/ChatHistorySidebar.tsx
// ✅ WEB Command Pack v4 - ChatGPT-like history sidebar

import React from "react";
import { listThreads, ChatThread, deleteThread } from "@/lib/chat/history";
import { cn } from "@/lib/utils";
import { MessageSquare, Plus, Trash2, X, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChatHistorySidebarProps {
  open: boolean;
  activeKey: string | null;
  onPick: (thread_key: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

export function ChatHistorySidebar({
  open,
  activeKey,
  onPick,
  onNewChat,
  onClose,
}: ChatHistorySidebarProps) {
  const { t, language } = useLanguage();
  const isArabic = language === "ar";
  const [threads, setThreads] = React.useState<ChatThread[]>([]);

  // Load threads on mount and when sidebar opens
  React.useEffect(() => {
    if (open) {
      setThreads(listThreads());
    }
  }, [open]);

  const handleDelete = (e: React.MouseEvent, thread_key: string) => {
    e.stopPropagation();
    deleteThread(thread_key);
    setThreads(listThreads());
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return isArabic ? "اليوم" : "Today";
      if (diffDays === 1) return isArabic ? "أمس" : "Yesterday";
      if (diffDays < 7) return isArabic ? `منذ ${diffDays} أيام` : `${diffDays} days ago`;
      
      return date.toLocaleDateString(isArabic ? "ar-SA" : "en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background/95 backdrop-blur-xl border-border transition-all duration-300 overflow-hidden",
        isArabic ? "border-l" : "border-r",
        open ? "w-64 opacity-100" : "w-0 opacity-0"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">
            {isArabic ? "المحادثات" : "History"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onNewChat}
            title={isArabic ? "محادثة جديدة" : "New chat"}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Threads List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads.map((thread) => (
            <div
              key={thread.thread_key}
              onClick={() => onPick(thread.thread_key)}
              className={cn(
                "group relative flex items-start gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200",
                "hover:bg-muted/80",
                activeKey === thread.thread_key
                  ? "bg-primary/10 border border-primary/20"
                  : "border border-transparent"
              )}
            >
              <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">
                  {thread.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(thread.updated_at)}
                </p>
              </div>
              
              {/* Delete button - shows on hover */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 end-2"
                onClick={(e) => handleDelete(e, thread.thread_key)}
              >
                <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}

          {threads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">
                {isArabic ? "لا توجد محادثات سابقة" : "No history yet"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onNewChat}
              >
                <Plus className="w-4 h-4 me-1" />
                {isArabic ? "ابدأ محادثة" : "Start a chat"}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
