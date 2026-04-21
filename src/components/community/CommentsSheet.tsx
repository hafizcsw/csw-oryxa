import { useEffect, useState, useCallback } from "react";
import { Send, X, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author_name?: string;
  author_avatar?: string;
}

interface CommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  isAr: boolean;
  userId: string | null;
  onCountChange?: (count: number) => void;
}

export function CommentsSheet({ open, onOpenChange, postId, isAr, userId, onCountChange }: CommentsSheetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_post_comments")
      .select("id, content, created_at, user_id")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    const userIds = [...new Set((data || []).map(c => c.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name, avatar_storage_path").in("user_id", userIds)
      : { data: [] };
    const pmap = new Map((profiles || []).map(p => [p.user_id, p]));

    const enriched = (data || []).map(c => ({
      ...c,
      author_name: pmap.get(c.user_id)?.full_name || (isAr ? "مستخدم" : "User"),
      author_avatar: pmap.get(c.user_id)?.avatar_storage_path,
    }));
    setComments(enriched);
    onCountChange?.(enriched.length);
    setLoading(false);
  }, [postId, isAr, onCountChange]);

  useEffect(() => {
    if (open) fetchComments();
  }, [open, fetchComments]);

  // Realtime new comments
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_post_comments", filter: `post_id=eq.${postId}` },
        () => fetchComments()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, postId, fetchComments]);

  const submit = async () => {
    if (!text.trim() || !userId) {
      if (!userId) toast.info(isAr ? "سجّل دخولك أولاً" : "Sign in first");
      return;
    }
    setPosting(true);
    const { error } = await supabase.from("community_post_comments").insert({
      post_id: postId, user_id: userId, content: text.trim(),
    });
    if (error) toast.error(isAr ? "تعذّر النشر" : "Failed to post");
    else { setText(""); fetchComments(); }
    setPosting(false);
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return isAr ? "الآن" : "now";
    if (m < 60) return isAr ? `${m} د` : `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return isAr ? `${h} س` : `${h}h`;
    return isAr ? `${Math.floor(h / 24)} ي` : `${Math.floor(h / 24)}d`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] sm:h-[80vh] sm:max-w-2xl sm:mx-auto rounded-t-2xl p-0 flex flex-col"
        dir={isAr ? "rtl" : "ltr"}
      >
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-5 h-5 text-primary" />
            {isAr ? "التعليقات" : "Comments"}
            <span className="text-muted-foreground text-sm font-normal">({comments.length})</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {isAr ? "كن أول من يعلّق" : "Be the first to comment"}
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {comments.map(c => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                      {c.author_name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-muted/60 rounded-2xl px-3.5 py-2">
                        <div className="text-xs font-semibold text-foreground">{c.author_name}</div>
                        <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{c.content}</div>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 px-2">{timeAgo(c.created_at)}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 bg-card">
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={userId ? (isAr ? "اكتب تعليقاً..." : "Write a comment...") : (isAr ? "سجّل دخولك للتعليق" : "Sign in to comment")}
              disabled={!userId}
              className="min-h-[44px] max-h-32 resize-none rounded-2xl bg-muted/60 border-0 focus-visible:ring-1 focus-visible:ring-primary text-sm"
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
            />
            <Button
              size="icon"
              onClick={submit}
              disabled={!text.trim() || posting || !userId}
              className={cn("rounded-full shrink-0 h-10 w-10", isAr && "rotate-180")}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
