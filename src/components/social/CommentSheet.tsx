import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useSocialComments, useAddComment } from "@/hooks/social/useSocialComments";
import { useSocialAuth } from "@/hooks/social/useSocialAuth";
import { avatarUrl, initials, timeAgo } from "./utils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SocialPost } from "@/hooks/social/useSocialFeed";

export function CommentSheet({
  open,
  onOpenChange,
  post,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  post: SocialPost;
}) {
  const { user } = useSocialAuth();
  const navigate = useNavigate();
  const { data: comments, isLoading } = useSocialComments(post.id, open);
  const add = useAddComment(post.id);
  const [text, setText] = useState("");

  const submit = async () => {
    if (!user) return navigate("/auth");
    if (!text.trim()) return;
    await add.mutateAsync({ userId: user.id, content: text.trim() });
    setText("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] bg-[hsl(var(--social-bg))] border-[hsl(var(--social-border))] text-[hsl(var(--social-text))] flex flex-col p-0"
      >
        <SheetHeader className="p-4 border-b border-[hsl(var(--social-border))]">
          <SheetTitle className="text-[hsl(var(--social-text))]">التعليقات</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {isLoading && <div className="text-center text-sm text-[hsl(var(--social-muted))] py-8">جارٍ التحميل…</div>}
          {!isLoading && comments?.length === 0 && (
            <div className="text-center text-sm text-[hsl(var(--social-muted))] py-8">
              كن أول من يعلق
            </div>
          )}
          {comments?.map((c) => (
            <div key={c.id} className="flex gap-3 py-3 border-b border-[hsl(var(--social-border))]">
              <Avatar className="w-9 h-9">
                <AvatarImage src={avatarUrl(c.author_avatar) ?? undefined} />
                <AvatarFallback>{initials(c.author_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold">{c.author_name || "مستخدم"}</span>
                  <span className="text-xs text-[hsl(var(--social-muted))]">{timeAgo(c.created_at)}</span>
                </div>
                <p dir="auto" className="text-sm mt-0.5 whitespace-pre-wrap break-words">
                  {c.content}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[hsl(var(--social-border))] p-3 flex gap-2 bg-[hsl(var(--social-bg))]">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="أضف تعليقاً…"
            autoResize
            maxHeight={120}
            dir="auto"
            className="flex-1 bg-[hsl(var(--social-surface))] border-transparent text-[hsl(var(--social-text))] resize-none"
          />
          <Button
            onClick={submit}
            disabled={!text.trim() || add.isPending}
            className="rounded-full bg-[hsl(var(--social-accent))] hover:bg-[hsl(var(--social-accent))]/90 text-white self-end"
          >
            نشر
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
