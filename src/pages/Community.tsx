import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Users, MapPin, GraduationCap, Building2, ArrowRight, Heart, MessageCircle, Send, Image, X, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type AuthorFilter = "all" | "student" | "university";

interface CommunityPost {
  id: string;
  author_type: string;
  author_user_id: string | null;
  university_id: string | null;
  content: string;
  image_url: string | null;
  tags: string[];
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  created_at: string;
  // joined
  author_name?: string;
  author_avatar?: string;
  university_name?: string;
  university_name_ar?: string;
  university_logo?: string;
  university_slug?: string;
  liked_by_me?: boolean;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: i * 0.05, ease: "easeOut" as const },
  }),
};

export default function Community() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AuthorFilter>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("community_posts")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter !== "all") {
      q = q.eq("author_type", filter);
    }

    const { data } = await q;
    if (!data) { setLoading(false); return; }

    // Enrich with author info
    const userIds = data.filter(p => p.author_user_id).map(p => p.author_user_id!);
    const uniIds = data.filter(p => p.university_id).map(p => p.university_id!);

    const [profilesRes, unisRes, likesRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("user_id, full_name, avatar_storage_path").in("user_id", userIds)
        : { data: [] },
      uniIds.length > 0
        ? supabase.from("universities").select("id, name, name_ar, logo_url, slug").in("id", uniIds)
        : { data: [] },
      userId
        ? supabase.from("community_post_likes").select("post_id").eq("user_id", userId).in("post_id", data.map(p => p.id))
        : { data: [] },
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const uniMap = new Map((unisRes.data || []).map(u => [u.id, u]));
    const likedSet = new Set((likesRes.data || []).map(l => l.post_id));

    const enriched: CommunityPost[] = data.map(p => {
      const profile = p.author_user_id ? profileMap.get(p.author_user_id) : null;
      const uni = p.university_id ? uniMap.get(p.university_id) : null;
      return {
        ...p,
        tags: p.tags || [],
        author_name: profile?.full_name || (isAr ? "طالب" : "Student"),
        author_avatar: profile?.avatar_storage_path,
        university_name: uni?.name,
        university_name_ar: uni?.name_ar,
        university_logo: uni?.logo_url,
        university_slug: uni?.slug,
        liked_by_me: likedSet.has(p.id),
      };
    });

    setPosts(enriched);
    setLoading(false);
  }, [filter, userId, isAr]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handlePost = async () => {
    if (!newPost.trim() || !userId) return;
    setPosting(true);
    const { error } = await supabase.from("community_posts").insert({
      author_type: "student",
      author_user_id: userId,
      content: newPost.trim(),
    });
    if (error) {
      toast.error(isAr ? "حدث خطأ" : "Something went wrong");
    } else {
      setNewPost("");
      setShowCompose(false);
      toast.success(isAr ? "تم النشر!" : "Posted!");
      fetchPosts();
    }
    setPosting(false);
  };

  const handleLike = async (post: CommunityPost) => {
    if (!userId) {
      toast.info(isAr ? "سجّل دخولك أولاً" : "Please sign in first");
      return;
    }
    if (post.liked_by_me) {
      await supabase.from("community_post_likes").delete().eq("post_id", post.id).eq("user_id", userId);
    } else {
      await supabase.from("community_post_likes").insert({ post_id: post.id, user_id: userId });
    }
    fetchPosts();
  };

  const filters: { key: AuthorFilter; label: string; icon: typeof Users }[] = [
    { key: "all", label: isAr ? "الكل" : "All", icon: Filter },
    { key: "university", label: isAr ? "الجامعات" : "Universities", icon: Building2 },
    { key: "student", label: isAr ? "الطلاب" : "Students", icon: Users },
  ];

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isAr ? "الآن" : "now";
    if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return isAr ? `منذ ${hrs} س` : `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return isAr ? `منذ ${days} ي` : `${days}d ago`;
  };

  return (
    <Layout>
      <section className="py-16 px-4 sm:px-6 bg-gradient-to-b from-muted/30 to-background min-h-[80vh]">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3 mb-8"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-primary bg-primary/10 px-3 py-1 rounded-full">
              <Users className="w-3.5 h-3.5" />
              {isAr ? "المجتمع" : "Community"}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {isAr ? "مجتمع الطلاب والجامعات" : "Student & University Community"}
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              {isAr
                ? "شارك تجربتك، اطرح أسئلتك، وتواصل مع الجامعات والطلاب"
                : "Share your experience, ask questions, and connect with universities and students"}
            </p>
          </motion.div>

          {/* Filters */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
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

          {/* Compose */}
          {userId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              {!showCompose ? (
                <button
                  onClick={() => setShowCompose(true)}
                  className="w-full p-4 rounded-xl border border-border bg-card text-muted-foreground text-sm text-start hover:border-primary/30 transition-colors"
                >
                  {isAr ? "شارك شيئاً مع المجتمع..." : "Share something with the community..."}
                </button>
              ) : (
                <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
                  <Textarea
                    value={newPost}
                    onChange={e => setNewPost(e.target.value)}
                    placeholder={isAr ? "اكتب منشورك هنا..." : "Write your post here..."}
                    className="min-h-[100px] resize-none border-0 p-0 focus-visible:ring-0 text-sm"
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <button className="text-muted-foreground hover:text-primary transition-colors">
                      <Image className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setShowCompose(false); setNewPost(""); }}>
                        {isAr ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button size="sm" onClick={handlePost} disabled={!newPost.trim() || posting} className="gap-1.5">
                        <Send className="w-3.5 h-3.5" />
                        {isAr ? "نشر" : "Post"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Posts Feed */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
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
                  <motion.div
                    key={post.id}
                    layout
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, scale: 0.95 }}
                    custom={i}
                    variants={fadeUp}
                    className={cn(
                      "rounded-xl border bg-card p-5 transition-all",
                      post.is_pinned ? "border-primary/30 bg-primary/[0.02]" : "border-border hover:border-border/80"
                    )}
                  >
                    {/* Author row */}
                    <div className="flex items-start gap-3">
                      {post.author_type === "university" ? (
                        <div
                          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer flex-shrink-0 border border-border"
                          onClick={() => post.university_slug && navigate(`/university/${post.university_slug}`)}
                        >
                          {post.university_logo ? (
                            <img src={post.university_logo} alt="" className="w-full h-full object-contain p-1" />
                          ) : (
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            {post.author_type === "university"
                              ? (isAr ? post.university_name_ar || post.university_name : post.university_name) || (isAr ? "جامعة" : "University")
                              : post.author_name}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            post.author_type === "university"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-emerald-500/10 text-emerald-600"
                          )}>
                            {post.author_type === "university" ? (isAr ? "جامعة" : "University") : (isAr ? "طالب" : "Student")}
                          </span>
                          {post.is_pinned && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                              📌 {isAr ? "مثبت" : "Pinned"}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <p className="mt-3 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>

                    {/* Image */}
                    {post.image_url && (
                      <div className="mt-3 rounded-lg overflow-hidden border border-border">
                        <img src={post.image_url} alt="" className="w-full max-h-80 object-cover" loading="lazy" />
                      </div>
                    )}

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {post.tags.map(tag => (
                          <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/50">
                      <button
                        onClick={() => handleLike(post)}
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium transition-colors",
                          post.liked_by_me ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                        )}
                      >
                        <Heart className={cn("w-4 h-4", post.liked_by_me && "fill-current")} />
                        {post.likes_count > 0 && post.likes_count}
                      </button>
                      <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        {post.comments_count > 0 && post.comments_count}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
