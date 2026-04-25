import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Share, Volume2, VolumeX, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSocialAuth } from "@/hooks/social/useSocialAuth";
import { useSocialLike } from "@/hooks/social/useSocialLike";
import { avatarUrl, initials, formatCount } from "@/components/social/utils";
import type { SocialPost } from "@/hooks/social/useSocialFeed";
import { useNavigate, Link } from "react-router-dom";

function ReelItem({ post, muted, onToggleMute }: { post: SocialPost; muted: boolean; onToggleMute: () => void }) {
  const { user } = useSocialAuth();
  const { liked, count, toggle } = useSocialLike(post.id, user?.id ?? null, post.likes_count);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio > 0.7) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: [0, 0.7, 1] }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const url = post.media_urls?.[0];

  return (
    <section className="snap-start h-[100dvh] w-full relative bg-black flex items-center justify-center">
      {url && (
        <video
          ref={videoRef}
          src={url}
          loop
          muted={muted}
          playsInline
          className="h-full w-full object-cover"
          onClick={onToggleMute}
        />
      )}

      <button
        onClick={onToggleMute}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white"
      >
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      <div className="absolute bottom-6 left-4 right-20 text-white">
        <Link to={`/social/u/${post.author_id}`} className="flex items-center gap-2 mb-2">
          <Avatar className="w-10 h-10 border-2 border-white">
            <AvatarImage src={avatarUrl(post.author_avatar) ?? undefined} />
            <AvatarFallback>{initials(post.author_name)}</AvatarFallback>
          </Avatar>
          <span className="font-bold">@{post.author_name || post.author_id.slice(0, 8)}</span>
        </Link>
        {post.content && (
          <p dir="auto" className="text-sm leading-5 line-clamp-3">
            {post.content}
          </p>
        )}
      </div>

      <div className="absolute bottom-6 right-4 flex flex-col items-center gap-5 text-white">
        <button onClick={toggle} className="flex flex-col items-center">
          <Heart
            className={`w-8 h-8 ${liked ? "text-[hsl(var(--social-like))]" : ""}`}
            fill={liked ? "currentColor" : "none"}
          />
          <span className="text-xs mt-0.5">{formatCount(count)}</span>
        </button>
        <button className="flex flex-col items-center">
          <MessageCircle className="w-8 h-8" />
          <span className="text-xs mt-0.5">{formatCount(post.comments_count)}</span>
        </button>
        <button className="flex flex-col items-center">
          <Share className="w-8 h-8" />
        </button>
      </div>
    </section>
  );
}

export default function SocialReels() {
  const [reels, setReels] = useState<SocialPost[]>([]);
  const [muted, setMuted] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("social_posts")
      .select("*")
      .eq("post_type", "video")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(async ({ data }) => {
        const posts = (data ?? []) as unknown as SocialPost[];
        const ids = Array.from(new Set(posts.map((p) => p.author_id)));
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_storage_path")
            .in("user_id", ids);
          const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
          for (const p of posts) {
            const pr: any = map.get(p.author_id);
            p.author_name = pr?.full_name ?? null;
            p.author_avatar = pr?.avatar_storage_path ?? null;
          }
        }
        setReels(posts);
      });
  }, []);

  return (
    <div className="-mx-px relative">
      <button
        onClick={() => navigate("/social")}
        className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/40 text-white"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="snap-y snap-mandatory overflow-y-scroll h-[100dvh]">
        {reels.length === 0 ? (
          <div className="h-[100dvh] flex items-center justify-center text-white">
            لا فيديوهات بعد
          </div>
        ) : (
          reels.map((r) => <ReelItem key={r.id} post={r} muted={muted} onToggleMute={() => setMuted((m) => !m)} />)
        )}
      </div>
    </div>
  );
}
