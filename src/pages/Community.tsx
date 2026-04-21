import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Users, Filter, Building2, Loader2, UserCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { CommunityComposer } from "@/components/community/CommunityComposer";
import { CommunityPostCard, type FeedPost } from "@/components/community/CommunityPostCard";
import type { ReactionKey } from "@/components/community/reactionConfig";

type AuthorFilter = "all" | "student" | "university";
const PAGE_SIZE = 10;

export default function Community() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<AuthorFilter>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>(isAr ? "أنت" : "You");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);

  // Auth + profile
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("user_id", uid).maybeSingle();
        if (p?.full_name) setUserName(p.full_name);
      }
    });
  }, []);

  const fetchPage = useCallback(async (page: number, replace: boolean) => {
    if (page === 0) setLoading(true); else setLoadingMore(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let cQ = supabase.from("community_posts")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (filter === "student") cQ = cQ.eq("author_type", "student");

    const uQ = supabase.from("university_posts")
      .select("id, university_id, post_type, title, body, status, pinned, published_at, attachments, created_at")
      .eq("status", "published")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    const [cRes, uRes] = await Promise.all([
      filter !== "university" ? cQ : Promise.resolve({ data: [] as any[] }),
      filter !== "student" ? uQ : Promise.resolve({ data: [] as any[] }),
    ]);

    const cData = (cRes.data || []) as any[];
    const uData = (uRes.data || []) as any[];

    const normUni = uData.map(p => ({
      id: p.id,
      author_type: "university" as const,
      author_user_id: null,
      university_id: p.university_id,
      content: [p.title, p.body].filter(Boolean).join("\n\n"),
      image_url: (() => {
        try {
          const atts = p.attachments as any[];
          return atts?.find((a: any) => a.type === "image")?.url || null;
        } catch { return null; }
      })(),
      tags: [] as string[],
      comments_count: 0,
      shares_count: 0,
      reactions_count: 0,
      is_pinned: p.pinned || false,
      created_at: p.published_at || p.created_at,
    }));

    const seen = new Set<string>();
    const merged = [...cData, ...normUni]
      .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
      .sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    if (merged.length < PAGE_SIZE) setHasMore(false);

    // Enrichment
    const userIds = merged.filter(p => p.author_user_id).map(p => p.author_user_id!);
    const uniIds = merged.filter(p => p.university_id).map(p => p.university_id!);
    const postIds = merged.map(p => p.id);

    const [profilesRes, unisRes, reactionsRes, myReactionsRes, savesRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id, full_name, avatar_storage_path").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      uniIds.length
        ? supabase.from("universities").select("id, name, name_ar, logo_url, slug").in("id", uniIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase.from("community_post_reactions").select("post_id, reaction").in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] }),
      userId && postIds.length
        ? supabase.from("community_post_reactions").select("post_id, reaction").eq("user_id", userId).in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] }),
      userId && postIds.length
        ? supabase.from("community_post_saves").select("post_id").eq("user_id", userId).in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const uniMap = new Map((unisRes.data || []).map(u => [u.id, u]));

    // Reactions summary per post
    const reactionAgg = new Map<string, Map<ReactionKey, number>>();
    let totalAgg = new Map<string, number>();
    (reactionsRes.data || []).forEach(r => {
      if (!reactionAgg.has(r.post_id)) reactionAgg.set(r.post_id, new Map());
      const m = reactionAgg.get(r.post_id)!;
      m.set(r.reaction as ReactionKey, (m.get(r.reaction as ReactionKey) || 0) + 1);
      totalAgg.set(r.post_id, (totalAgg.get(r.post_id) || 0) + 1);
    });
    const myMap = new Map((myReactionsRes.data || []).map(r => [r.post_id, r.reaction as ReactionKey]));
    const savedSet = new Set((savesRes.data || []).map(s => s.post_id));

    const enriched: FeedPost[] = merged.map(p => {
      const profile = p.author_user_id ? profileMap.get(p.author_user_id) : null;
      const uni = p.university_id ? uniMap.get(p.university_id) : null;
      const summary = Array.from((reactionAgg.get(p.id) || new Map()).entries()).map(
        ([key, count]) => ({ key: key as ReactionKey, count: count as number })
      );
      return {
        ...p,
        tags: p.tags || [],
        author_name: profile?.full_name || (isAr ? "طالب" : "Student"),
        author_avatar: profile?.avatar_storage_path,
        university_name: uni?.name,
        university_name_ar: uni?.name_ar,
        university_logo: uni?.logo_url,
        university_slug: uni?.slug,
        my_reaction: myMap.get(p.id) || null,
        reactions_summary: summary,
        total_reactions: totalAgg.get(p.id) || 0,
        saved_by_me: savedSet.has(p.id),
      };
    });

    setPosts(prev => replace ? enriched : [...prev, ...enriched]);
    setLoading(false);
    setLoadingMore(false);
  }, [filter, userId, isAr]);

  // Reset on filter change
  useEffect(() => {
    pageRef.current = 0;
    setHasMore(true);
    fetchPage(0, true);
  }, [fetchPage]);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingMore) {
        pageRef.current += 1;
        fetchPage(pageRef.current, false);
      }
    }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, fetchPage]);

  const refresh = useCallback(() => {
    pageRef.current = 0;
    setHasMore(true);
    fetchPage(0, true);
  }, [fetchPage]);

  const filters: { key: AuthorFilter; label: string; icon: typeof Users }[] = [
    { key: "all", label: isAr ? "الكل" : "All", icon: Filter },
    { key: "university", label: isAr ? "الجامعات" : "Universities", icon: Building2 },
    { key: "student", label: isAr ? "الطلاب" : "Students", icon: Users },
  ];

  return (
    <Layout>
      <section className="py-10 px-3 sm:px-6 bg-gradient-to-b from-muted/40 to-background min-h-[80vh]" dir={isAr ? "rtl" : "ltr"}>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3 mb-6"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-primary bg-primary/10 px-3 py-1 rounded-full">
              <Users className="w-3.5 h-3.5" />
              {isAr ? "المجتمع" : "Community"}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {isAr ? "مجتمع الطلاب والجامعات" : "Student & University Community"}
            </h1>
            {userId && (
              <Link
                to="/community/me"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <UserCircle2 className="w-3.5 h-3.5" />
                {isAr ? "حسابي ومحفوظاتي" : "My profile & saved"}
              </Link>
            )}
          </motion.div>

          {/* Sticky filter bar */}
          <div className="sticky top-16 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-md mb-4">
            <div className="flex items-center justify-center gap-2 overflow-x-auto">
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                    filter === f.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                  )}
                >
                  <f.icon className="w-3.5 h-3.5" />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Composer */}
          <div className="mb-4">
            <CommunityComposer userId={userId} userName={userName} isAr={isAr} onPosted={refresh} />
          </div>

          {/* Feed */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl bg-card border border-border p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full bg-muted" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 w-32 bg-muted rounded" />
                      <div className="h-2.5 w-20 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-3/4 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 rounded-2xl border border-border bg-card"
            >
              <Users className="w-14 h-14 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-1">
                {isAr ? "لا توجد منشورات بعد" : "No posts yet"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAr ? "كن أول من ينشر في المجتمع!" : "Be the first to post in the community!"}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {posts.map((post, i) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    isAr={isAr}
                    userId={userId}
                    onChange={refresh}
                    index={i}
                  />
                ))}
              </AnimatePresence>

              {/* Infinite-scroll sentinel */}
              <div ref={sentinelRef} className="h-12 flex items-center justify-center">
                {loadingMore && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                {!hasMore && posts.length > 5 && (
                  <span className="text-xs text-muted-foreground">{isAr ? "وصلت للنهاية ✨" : "You're all caught up ✨"}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
