import { useState } from 'react';
import { Plus, MessageSquare, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface ChatSessionItem {
  id: string;
  created_at: string;
  preview: string;
}

interface ChatSessionsSidebarProps {
  sessions: ChatSessionItem[];
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession?: (sessionId: string) => void;
}

export function ChatSessionsSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: ChatSessionsSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'اليوم';
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    return date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
  };

  const truncatePreview = (text: string, maxLen = 25) => {
    if (!text) return 'محادثة جديدة';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  return (
    <div className="h-full bg-background flex flex-col">
        {/* New Chat Button */}
        <div className="p-2 border-b border-border flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs h-8"
            onClick={onNewChat}
          >
            <Plus className="w-3.5 h-3.5" />
            محادثة جديدة
          </Button>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                لا توجد محادثات سابقة
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group relative p-2 rounded-md cursor-pointer transition-colors text-right",
                    session.id === currentSessionId
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => onSelectSession(session.id)}
                  onMouseEnter={() => setHoveredId(session.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="flex items-start gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate leading-tight">
                        {truncatePreview(session.preview)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDate(session.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Delete Button */}
                  {onDeleteSession && hoveredId === session.id && session.id !== currentSessionId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
    </div>
  );
}
