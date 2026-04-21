import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Share2, Bookmark, BookmarkCheck, MoreHorizontal, Building2, Users, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReactionPicker } from "./ReactionPicker";
import { CommentsSheet } from "./CommentsSheet";
import { REACTION_MAP, type ReactionKey } from "./reactionConfig";

export interface FeedPost {
  id: string;
  author_type: string;
  author_user_id: string | null;
  university_id: string | null;
  content: string;
  image_url: string | null;
  tags: string[];
  comments_count: number;
  shares_count?: number;
  is_pinned: boolean;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
  university_name?: string;
  university_name_ar?: string;
  university_logo?: string;
  university_slug?: string;
  my_reaction?: ReactionKey | null;
  reactions_summary?: { key: ReactionKey; count: number }[];
  total_reactions?: number;
  saved_by_me?: boolean;
}

interface Props {
  post: FeedPost;
  isAr: boolean;
  userId: string | null;
  onChange: () => void;
  index: number;
}

export function CommunityPostCard({ post, isAr, userId, onChange, index }: Props) {
  const navigate = useNavigate();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [optimisticReaction, setOptimisticReaction] = useState<ReactionKey | null | undefined>(undefined);
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | undefined>(undefined);

  const current = optimisticReaction !== undefined ? optimisticReaction : (post.my_reaction ?? null);
  const saved = optimisticSaved !== undefined ? optimisticSaved : !!post.saved_by_me;

  const reactionTotal = (post.total_reactions || 0) + (
    optimisticReaction === undefined ? 0 :
      (current ? 1 : 0) - (post.my_reaction ? 1 : 0)
  );

  const top3 = [...(post.reactions_summary || [])].sort((a, b) => b.count - a.count).slice(0, 3);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return isAr ? "الآن" : "now";
    if (m < 60) return isAr ? `منذ ${m} د` : `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return isAr ? `منذ ${h} س` : `${h}h`;
    return isAr ? `منذ ${Math.floor(h / 24)} ي` : `${Math.floor(h / 24)}d`;
  };

  const onReact = async (next: ReactionKey | null) => {
    if (!userId) {
      toast.info(isAr ? "سجّل دخولك أولاً" : "Sign in first");
      return;
    }
    setOptimisticReaction(next);
    try {
      if (next === null) {
        await supabase.from("community_post_reactions").delete().eq("post_id", post.id).eq("user_id", userId);
      } else {
        await supabase.from("community_post_reactions").upsert(
          { post_id: post.id, user_id: userId, reaction: next },
          { onConflict: "post_id,user_id" }
        );
      }
      onChange();
    } catch {
      setOptimisticReaction(post.my_reaction ?? null);
    }
  };

  const onSave = async () => {
    if (!userId) {
      toast.info(isAr ? "سجّل دخولك أولاً" : "Sign in first");
      return;
    }
    const next = !saved;
    setOptimisticSaved(next);
    try {
      if (next) {
        await supabase.from("community_post_saves").insert({ post_id: post.id, user_id: userId });
        toast.success(isAr ? "تم الحفظ" : "Saved");
      } else {
        await supabase.from("community_post_saves").delete().eq("post_id", post.id).eq("user_id", userId);
      }
    } catch { setOptimisticSaved(saved); }
  };

  const onShare = async () => {
    const url = `${window.location.origin}/community#post-${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.author_name || "Community", text: post.content.slice(0, 80), url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(isAr ? "تم نسخ الرابط" : "Link copied");
      }
    } catch {/* user cancelled */}
  };

  const isUni = post.author_type === "university";
  const displayName = isUni
    ? (isAr ? post.university_name_ar || post.university_name : post.university_name) || (isAr ? "جامعة" : "University")
    : post.author_name;

  return (
    <motion.article
      id={`post-${post.id}`}
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.21, 0.47, 0.32, 0.98] }}
      className={cn(
        "rounded-2xl bg-card border shadow-sm overflow-hidden",
        post.is_pinned ? "border-primary/40" : "border-border"
      )}
    >
      {post.is_pinned && (
        <div className="px-4 pt-3 text-[11px] font-semibold text-primary flex items-center gap-1.5">
          📌 {isAr ? "منشور مثبّت" : "Pinned post"}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <button
          onClick={() => {
            if (isUni && post.university_slug) navigate(`/university/${post.university_slug}`);
            else if (!isUni && post.author_user_id) navigate(`/community/u/${post.author_user_id}`);
          }}
          className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-primary/40 transition-all",
            isUni ? "bg-muted border border-border" : "bg-gradient-to-br from-primary/25 to-accent/25"
          )}
        >
          {isUni ? (
            post.university_logo
              ? <img src={post.university_logo} alt="" className="w-full h-full object-contain p-1" />
              : <Building2 className="w-5 h-5 text-muted-foreground" />
          ) : (
            <span className="text-sm font-bold text-primary">{displayName?.charAt(0).toUpperCase() || "?"}</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                if (isUni && post.university_slug) navigate(`/university/${post.university_slug}`);
                else if (!isUni && post.author_user_id) navigate(`/community/u/${post.author_user_id}`);
              }}
              className="font-semibold text-sm text-foreground truncate hover:underline text-start"
            >
              {displayName}
            </button>
            {isUni && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                ✓ {isAr ? "موثّق" : "Verified"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>{timeAgo(post.created_at)}</span>
            <span>·</span>
            <Globe2 className="w-3 h-3" />
          </div>
        </div>

        <button className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-[15px] text-foreground/95 leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </p>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {post.tags.map(tag => (
                <span key={tag} className="text-xs text-primary hover:underline cursor-pointer">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image */}
      {post.image_url && (
        <div className="bg-muted/40">
          <img
            src={post.image_url}
            alt=""
            className="w-full max-h-[560px] object-cover cursor-pointer"
            loading="lazy"
            onClick={() => window.open(post.image_url!, "_blank")}
          />
        </div>
      )}

      {/* Stats row */}
      {(reactionTotal > 0 || post.comments_count > 0 || (post.shares_count || 0) > 0) && (
        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {top3.length > 0 && (
              <div className="flex -space-x-1">
                {top3.map(r => (
                  <span
                    key={r.key}
                    className="w-5 h-5 rounded-full bg-card border border-card flex items-center justify-center text-xs"
                  >
                    {REACTION_MAP[r.key].emoji}
                  </span>
                ))}
              </div>
            )}
            {reactionTotal > 0 && <span className="ms-1">{reactionTotal}</span>}
          </div>
          <div className="flex items-center gap-3">
            {post.comments_count > 0 && (
              <button onClick={() => setCommentsOpen(true)} className="hover:underline">
                {post.comments_count} {isAr ? "تعليق" : post.comments_count === 1 ? "comment" : "comments"}
              </button>
            )}
            {(post.shares_count || 0) > 0 && (
              <span>{post.shares_count} {isAr ? "مشاركة" : "shares"}</span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mx-4 border-t border-border" />
      <div className="flex items-stretch px-2 py-1">
        <ReactionPicker current={current} count={0} isAr={isAr} onReact={onReact} />
        <button
          onClick={() => setCommentsOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          {isAr ? "تعليق" : "Comment"}
        </button>
        <button
          onClick={onShare}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <Share2 className="w-4 h-4" />
          {isAr ? "مشاركة" : "Share"}
        </button>
        <button
          onClick={onSave}
          className={cn(
            "flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-colors",
            saved ? "text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          title={isAr ? "حفظ" : "Save"}
        >
          {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </div>

      <CommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        postId={post.id}
        isAr={isAr}
        userId={userId}
        onCountChange={() => onChange()}
      />
    </motion.article>
  );
}
