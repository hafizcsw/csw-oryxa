import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bookmark, FileText, Users, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layout } from "@/components/layout/Layout";
import { CommunityPostCard, type FeedPost } from "@/components/community/CommunityPostCard";
import type { ReactionKey } from "@/components/community/reactionConfig";
import { cn } from "@/lib/utils";

type Tab = "posts" | "saved";

interface ProfileData {
  user_id: string;
  full_name: string | null;
  avatar_storage_path: string | null;
  created_at?: string;
}

export default function CommunityProfile() {
  const { userId: routeUserId } = useParams<{ userId: string }>();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [me, setMe] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ posts: 0, saved: 0 });

  const profileId = routeUserId || me;
  const isOwn = !!me && me === profileId;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  // Profile + counts
  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [{ data: p }, { count: postsCount }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_storage_path, created_at").eq("user_id", profileId).maybeSingle(),
        supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("author_user_id", profileId),
      ]);
      setProfile(p as ProfileData);
      let savedCount = 0;
      if (isOwn) {
        const { count } = await supabase.from("community_post_saves").select("id", { count: "exact", head: true }).eq("user_id", profileId);
        savedCount = count || 0;
      }
      setCounts({ posts: postsCount || 0, saved: savedCount });
    })();
  }, [profileId, isOwn]);

  // Feed
  const fetchFeed = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);

    let baseRows: any[] = [];

    if (tab === "posts") {
      const { data } = await supabase.from("community_posts")
        .select("*").eq("author_user_id", profileId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      baseRows = data || [];
    } else {
      // saved — own only
      if (!isOwn) { setPosts([]); setLoading(false); return; }
      const { data: saves } = await supabase.from("community_post_saves")
        .select("post_id, created_at").eq("user_id", profileId)
        .order("created_at", { ascending: false }).limit(50);
      const ids = (saves || []).map(s => s.post_id);
      if (!ids.length) { setPosts([]); setLoading(false); return; }
      const { data } = await supabase.from("community_posts").select("*").in("id", ids);
      const order = new Map(ids.map((id, i) => [id, i]));
      baseRows = (data || []).sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
    }

    const ids = baseRows.map(p => p.id);
    const userIds = baseRows.filter(p => p.author_user_id).map(p => p.author_user_id);

    const [profilesRes, reactionsRes, myReactionsRes, savesRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id, full_name, avatar_storage_path").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from("community_post_reactions").select("post_id, reaction").in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      me && ids.length
        ? supabase.from("community_post_reactions").select("post_id, reaction").eq("user_id", me).in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      me && ids.length
        ? supabase.from("community_post_saves").select("post_id").eq("user_id", me).in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const pmap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const reactionAgg = new Map<string, Map<ReactionKey, number>>();
    const totalAgg = new Map<string, number>();
    (reactionsRes.data || []).forEach(r => {
      if (!reactionAgg.has(r.post_id)) reactionAgg.set(r.post_id, new Map());
      const m = reactionAgg.get(r.post_id)!;
      m.set(r.reaction as ReactionKey, (m.get(r.reaction as ReactionKey) || 0) + 1);
      totalAgg.set(r.post_id, (totalAgg.get(r.post_id) || 0) + 1);
    });
    const myMap = new Map((myReactionsRes.data || []).map(r => [r.post_id, r.reaction as ReactionKey]));
    const savedSet = new Set((savesRes.data || []).map(s => s.post_id));

    const enriched: FeedPost[] = baseRows.map(p => {
      const prof = p.author_user_id ? pmap.get(p.author_user_id) : null;
      const summary = Array.from((reactionAgg.get(p.id) || new Map()).entries()).map(
        ([key, count]) => ({ key: key as ReactionKey, count: count as number })
      );
      return {
        ...p,
        tags: p.tags || [],
        author_name: prof?.full_name || (isAr ? "طالب" : "Student"),
        author_avatar: prof?.avatar_storage_path,
        my_reaction: myMap.get(p.id) || null,
        reactions_summary: summary,
        total_reactions: totalAgg.get(p.id) || 0,
        saved_by_me: savedSet.has(p.id),
      };
    });

    setPosts(enriched);
    setLoading(false);
  }, [profileId, tab, me, isOwn, isAr]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  if (!profileId) {
    return <Layout><div className="py-20 text-center text-muted-foreground">{isAr ? "سجّل دخولك لعرض حسابك" : "Sign in to view your profile"}</div></Layout>;
  }

  const displayName = profile?.full_name || (isAr ? "طالب" : "Student");
  const initial = displayName.charAt(0).toUpperCase();
  const joinedAt = profile?.created_at
    ? new Intl.DateTimeFormat(isAr ? "ar" : undefined, { year: "numeric", month: "long" }).format(new Date(profile.created_at))
    : null;

  const tabs: { key: Tab; label: string; icon: typeof FileText; show: boolean }[] = [
    { key: "posts", label: isAr ? "المنشورات" : "Posts", icon: FileText, show: true },
    { key: "saved", label: isAr ? "المحفوظات" : "Saved", icon: Bookmark, show: isOwn },
  ];

  return (
    <Layout>
      <section className="bg-gradient-to-b from-muted/40 to-background min-h-[80vh]" dir={isAr ? "rtl" : "ltr"}>
        {/* Cover + identity */}
        <div className="relative">
          <div className="h-40 sm:h-56 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/10" />
          <div className="max-w-2xl mx-auto px-3 sm:px-6 -mt-14 sm:-mt-16 pb-4">
            <div className="flex items-end gap-4">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 ring-4 ring-background flex items-center justify-center text-3xl sm:text-4xl font-bold text-primary shadow-xl flex-shrink-0"
              >
                {initial}
              </motion.div>
              <div className="flex-1 pb-2 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{displayName}</h1>
                {joinedAt && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {isAr ? `انضم في ${joinedAt}` : `Joined ${joinedAt}`}
                  </div>
                )}
              </div>
              <Link
                to="/community"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className={cn("w-4 h-4", isAr && "rotate-180")} />
                {isAr ? "المجتمع" : "Community"}
              </Link>
            </div>

            {/* Stat pills */}
            <div className="flex items-center gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <strong>{counts.posts}</strong> {isAr ? "منشور" : "posts"}
              </span>
              {isOwn && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs">
                  <Bookmark className="w-3.5 h-3.5 text-primary" />
                  <strong>{counts.saved}</strong> {isAr ? "محفوظ" : "saved"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-3 sm:px-6">
          <div className="flex items-center gap-1 border-b border-border mb-4">
            {tabs.filter(t => t.show).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Feed */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
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
              {tab === "posts" ? (
                <FileText className="w-14 h-14 text-muted-foreground/30 mx-auto mb-3" />
              ) : (
                <Bookmark className="w-14 h-14 text-muted-foreground/30 mx-auto mb-3" />
              )}
              <h3 className="text-lg font-bold text-foreground mb-1">
                {tab === "posts"
                  ? (isOwn ? (isAr ? "لم تنشر شيئاً بعد" : "You haven't posted yet") : (isAr ? "لا توجد منشورات" : "No posts"))
                  : (isAr ? "لا يوجد محفوظ" : "Nothing saved yet")}
              </h3>
              {tab === "posts" && isOwn && (
                <Link to="/community" className="text-sm text-primary hover:underline mt-2 inline-block">
                  {isAr ? "اذهب للمجتمع وانشر منشورك الأول →" : "Go to community and post →"}
                </Link>
              )}
            </motion.div>
          ) : (
            <div className="space-y-4 pb-12">
              <AnimatePresence mode="popLayout">
                {posts.map((p, i) => (
                  <CommunityPostCard
                    key={p.id}
                    post={p}
                    isAr={isAr}
                    userId={me}
                    onChange={fetchFeed}
                    index={i}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
