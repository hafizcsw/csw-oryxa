import { useState, useEffect, useRef } from "react";
import { FeedTabs } from "@/components/social/FeedTabs";
import { StoriesRow } from "@/components/social/StoriesRow";
import { PostComposer } from "@/components/social/PostComposer";
import { PostCard } from "@/components/social/PostCard";
import { useSocialFeed } from "@/hooks/social/useSocialFeed";

export default function SocialFeed() {
  const [tab, setTab] = useState<"for-you" | "following">("for-you");
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useSocialFeed();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" }
    );
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <>
      <FeedTabs value={tab} onChange={setTab} />
      <StoriesRow />
      <PostComposer />

      {isLoading && (
        <div className="p-8 text-center text-sm text-[hsl(var(--social-muted))]">
          جارٍ تحميل المنشورات…
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <div className="p-12 text-center">
          <div className="text-6xl mb-3">✨</div>
          <h3 className="text-xl font-bold mb-2">لا منشورات بعد</h3>
          <p className="text-sm text-[hsl(var(--social-muted))]">كن أول من ينشر شيئاً!</p>
        </div>
      )}

      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}

      <div ref={sentinelRef} className="h-12 flex items-center justify-center">
        {isFetchingNextPage && (
          <span className="text-sm text-[hsl(var(--social-muted))]">…</span>
        )}
      </div>
    </>
  );
}
