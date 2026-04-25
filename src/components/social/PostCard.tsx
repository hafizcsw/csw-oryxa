import { Heart, MessageCircle, Repeat2, Bookmark, Share, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SocialPost } from "@/hooks/social/useSocialFeed";
import { useSocialLike } from "@/hooks/social/useSocialLike";
import { useSocialAuth } from "@/hooks/social/useSocialAuth";
import { avatarUrl, initials, timeAgo, formatCount } from "./utils";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { CommentSheet } from "./CommentSheet";

export function PostCard({ post }: { post: SocialPost }) {
  const { user } = useSocialAuth();
  const navigate = useNavigate();
  const { liked, count, toggle } = useSocialLike(post.id, user?.id ?? null, post.likes_count);
  const [showComments, setShowComments] = useState(false);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return navigate("/auth");
    toggle();
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(true);
  };

  const media = post.media_urls ?? [];
  const isVideo = post.post_type === "video";

  return (
    <article className="border-b border-[hsl(var(--social-border))] px-4 py-3 hover:bg-white/[0.02] transition cursor-pointer">
      <div className="flex gap-3">
        <Link to={`/social/u/${post.author_id}`} onClick={(e) => e.stopPropagation()}>
          <Avatar className="w-11 h-11 shrink-0">
            <AvatarImage src={avatarUrl(post.author_avatar) ?? undefined} />
            <AvatarFallback>{initials(post.author_name)}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <Link
              to={`/social/u/${post.author_id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-bold text-[hsl(var(--social-text))] truncate hover:underline"
            >
              {post.author_name || "مستخدم"}
            </Link>
            <span className="text-[hsl(var(--social-muted))] truncate">
              @{post.author_id.slice(0, 8)}
            </span>
            <span className="text-[hsl(var(--social-muted))]">·</span>
            <span className="text-[hsl(var(--social-muted))] shrink-0">
              {timeAgo(post.created_at)}
            </span>
            <button
              className="ml-auto p-1.5 rounded-full hover:bg-[hsl(var(--social-accent))]/10 text-[hsl(var(--social-muted))]"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {post.content && (
            <p
              dir="auto"
              className="mt-1 text-[15px] leading-6 text-[hsl(var(--social-text))] whitespace-pre-wrap break-words"
            >
              {post.content}
            </p>
          )}

          {media.length > 0 && (
            <div
              className={`mt-3 grid gap-1 rounded-2xl overflow-hidden border border-[hsl(var(--social-border))] ${
                media.length > 1 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {media.map((url, i) =>
                isVideo ? (
                  <video
                    key={i}
                    src={url}
                    controls
                    playsInline
                    className="w-full max-h-[520px] object-cover bg-black"
                  />
                ) : (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    loading="lazy"
                    className="w-full max-h-[520px] object-cover"
                  />
                )
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 max-w-md text-[hsl(var(--social-muted))]">
            <button
              onClick={handleComment}
              className="group flex items-center gap-1 hover:text-[hsl(var(--social-accent))] transition"
            >
              <span className="p-2 rounded-full group-hover:bg-[hsl(var(--social-accent))]/10">
                <MessageCircle className="w-[18px] h-[18px]" />
              </span>
              <span className="text-sm">{formatCount(post.comments_count)}</span>
            </button>

            <button
              onClick={(e) => e.stopPropagation()}
              className="group flex items-center gap-1 hover:text-emerald-500 transition"
            >
              <span className="p-2 rounded-full group-hover:bg-emerald-500/10">
                <Repeat2 className="w-[18px] h-[18px]" />
              </span>
              <span className="text-sm">0</span>
            </button>

            <button
              onClick={handleLike}
              className={`group flex items-center gap-1 transition ${
                liked ? "text-[hsl(var(--social-like))]" : "hover:text-[hsl(var(--social-like))]"
              }`}
            >
              <span className="p-2 rounded-full group-hover:bg-[hsl(var(--social-like))]/10">
                <Heart
                  className="w-[18px] h-[18px]"
                  fill={liked ? "currentColor" : "none"}
                />
              </span>
              <span className="text-sm">{formatCount(count)}</span>
            </button>

            <button
              onClick={(e) => e.stopPropagation()}
              className="group flex items-center gap-1 hover:text-[hsl(var(--social-accent))] transition"
            >
              <span className="p-2 rounded-full group-hover:bg-[hsl(var(--social-accent))]/10">
                <Bookmark className="w-[18px] h-[18px]" />
              </span>
            </button>

            <button
              onClick={(e) => e.stopPropagation()}
              className="group flex items-center gap-1 hover:text-[hsl(var(--social-accent))] transition"
            >
              <span className="p-2 rounded-full group-hover:bg-[hsl(var(--social-accent))]/10">
                <Share className="w-[18px] h-[18px]" />
              </span>
            </button>
          </div>
        </div>
      </div>

      <CommentSheet open={showComments} onOpenChange={setShowComments} post={post} />
    </article>
  );
}
