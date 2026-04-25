import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useSocialFeed } from "@/hooks/social/useSocialFeed";
import { PostCard } from "@/components/social/PostCard";
import { useSocialAuth } from "@/hooks/social/useSocialAuth";
import { useFollow } from "@/hooks/social/useFollow";
import { avatarUrl, initials } from "@/components/social/utils";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SocialProfile() {
  const { userId = "" } = useParams();
  const navigate = useNavigate();
  const { user: viewer } = useSocialAuth();
  const [profile, setProfile] = useState<any>(null);
  const { data } = useSocialFeed(userId);
  const { isFollowing, toggle, pending } = useFollow(userId, viewer?.id ?? null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, full_name, avatar_storage_path, city, country")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [userId]);

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];
  const isMe = viewer?.id === userId;

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 bg-[hsl(var(--social-bg))]/80 backdrop-blur border-b border-[hsl(var(--social-border))]">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black">{profile?.full_name || "مستخدم"}</h1>
          <p className="text-xs text-[hsl(var(--social-muted))]">{posts.length} منشور</p>
        </div>
      </div>

      <div className="h-44 bg-gradient-to-br from-[hsl(var(--social-accent))]/40 via-purple-600/30 to-pink-500/30" />

      <div className="px-4 -mt-14 relative">
        <div className="flex items-end justify-between">
          <Avatar className="w-28 h-28 border-4 border-[hsl(var(--social-bg))] bg-[hsl(var(--social-surface))]">
            <AvatarImage src={avatarUrl(profile?.avatar_storage_path) ?? undefined} />
            <AvatarFallback className="text-3xl">{initials(profile?.full_name)}</AvatarFallback>
          </Avatar>
          {!isMe && viewer && (
            <Button
              onClick={toggle}
              disabled={pending}
              className={
                isFollowing
                  ? "rounded-full bg-transparent border border-[hsl(var(--social-border))] text-[hsl(var(--social-text))] hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500"
                  : "rounded-full bg-[hsl(var(--social-text))] text-[hsl(var(--social-bg))] hover:bg-[hsl(var(--social-text))]/90"
              }
            >
              {isFollowing ? "متابَع" : "متابعة"}
            </Button>
          )}
        </div>

        <div className="mt-3">
          <h2 className="text-xl font-black">{profile?.full_name || "مستخدم"}</h2>
          <p className="text-sm text-[hsl(var(--social-muted))]">@{userId.slice(0, 12)}</p>
          {(profile?.city || profile?.country) && (
            <p className="text-sm mt-2 text-[hsl(var(--social-muted))]">
              📍 {[profile.city, profile.country].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 mt-6 border-b border-[hsl(var(--social-border))]">
        {["منشورات", "ردود", "وسائط"].map((t, i) => (
          <button
            key={t}
            className={`py-4 text-sm font-bold ${
              i === 0
                ? "text-[hsl(var(--social-text))] border-b-2 border-[hsl(var(--social-accent))]"
                : "text-[hsl(var(--social-muted))]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="p-12 text-center text-sm text-[hsl(var(--social-muted))]">
          لا منشورات بعد.
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </>
  );
}
