import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { SocialPost } from "@/hooks/social/useSocialFeed";

const TRENDING = [
  "#الجامعات_العالمية",
  "#منح_دراسية",
  "#Oryxa",
  "#طلاب_دوليون",
  "#قبول_جامعي",
  "#تعلم_اللغات",
  "#حياة_طلابية",
  "#السكن_الجامعي",
];

export default function SocialExplore() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("social_posts")
      .select("*")
      .eq("is_deleted", false)
      .not("media_urls", "is", null)
      .order("likes_count", { ascending: false })
      .limit(48)
      .then(({ data }) => {
        const items = (data ?? []) as unknown as SocialPost[];
        setPosts(items.filter((p) => p.media_urls && p.media_urls.length));
      });
  }, []);

  return (
    <div className="min-h-screen">
      {/* Sticky search */}
      <div className="sticky top-0 z-10 bg-[hsl(var(--social-bg))]/85 backdrop-blur border-b border-[hsl(var(--social-border))] px-4 py-3">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--social-muted))]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن أشخاص، منشورات، وسوم"
            className="pe-10 h-11 rounded-full bg-[hsl(var(--social-surface))] border-transparent"
          />
        </div>
      </div>

      {/* Trending chips */}
      <section className="px-4 py-4 border-b border-[hsl(var(--social-border))]">
        <h2 className="text-sm font-bold text-[hsl(var(--social-muted))] mb-3">
          وسوم رائجة
        </h2>
        <div className="flex flex-wrap gap-2">
          {TRENDING.map((tag) => (
            <button
              key={tag}
              className="px-3 py-1.5 rounded-full bg-[hsl(var(--social-surface))] text-sm font-semibold hover:bg-[hsl(var(--social-accent))]/20 hover:text-[hsl(var(--social-accent))] transition"
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* Mosaic grid */}
      <section className="p-1">
        {posts.length === 0 ? (
          <div className="p-12 text-center text-sm text-[hsl(var(--social-muted))]">
            لا وسائط رائجة بعد.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map((p, i) => {
              const isVideo = p.post_type === "video";
              const url = p.media_urls?.[0];
              // every 7th is wide
              const wide = i % 11 === 4;
              const tall = i % 11 === 7;
              return (
                <Link
                  key={p.id}
                  to={isVideo ? "/social/reels" : `/social/u/${p.author_id}`}
                  className={`relative block bg-[hsl(var(--social-surface))] overflow-hidden group ${
                    wide ? "col-span-2" : ""
                  } ${tall ? "row-span-2" : ""}`}
                  style={{ aspectRatio: tall ? "1/2" : wide ? "2/1" : "1/1" }}
                >
                  {isVideo ? (
                    <video
                      src={url}
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover transition group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
