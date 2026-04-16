import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Users, Building2, ArrowRight, Heart, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PreviewPost {
  id: string;
  author_type: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  // joined
  author_name?: string;
  university_name?: string;
  university_name_ar?: string;
  university_logo?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

export function UniversityCommunitySection() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";
  const isRTL = ["ar", "he", "fa", "ur"].includes(language);
  const [posts, setPosts] = useState<PreviewPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("community_posts")
        .select("id, author_type, author_user_id, university_id, content, image_url, likes_count, comments_count, created_at")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6);

      if (!data || data.length === 0) {
        // Fallback: show university cards if no community posts yet
        setLoading(false);
        return;
      }

      const userIds = data.filter(p => p.author_user_id).map(p => p.author_user_id!);
      const uniIds = data.filter(p => p.university_id).map(p => p.university_id!);

      const [profilesRes, unisRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
          : { data: [] },
        uniIds.length > 0
          ? supabase.from("universities").select("id, name, name_ar, logo_url").in("id", uniIds)
          : { data: [] },
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const uniMap = new Map((unisRes.data || []).map(u => [u.id, u]));

      setPosts(data.map(p => {
        const profile = p.author_user_id ? profileMap.get(p.author_user_id) : null;
        const uni = p.university_id ? uniMap.get(p.university_id) : null;
        return {
          ...p,
          author_name: profile?.full_name || (isAr ? "طالب" : "Student"),
          university_name: uni?.name,
          university_name_ar: uni?.name_ar,
          university_logo: uni?.logo_url,
        };
      }));
      setLoading(false);
    })();
  }, [isAr]);

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

  // Show empty state invitation if no posts
  const showEmptyState = !loading && posts.length === 0;

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3 mb-12"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-primary bg-primary/10 px-3 py-1 rounded-full">
            <Users className="w-3.5 h-3.5" />
            {isAr ? "المجتمع" : "Community"}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            {isAr ? "مجتمع الطلاب والجامعات" : "Student & University Community"}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {isAr
              ? "شارك تجربتك وتواصل مع الجامعات والطلاب من حول العالم"
              : "Share your experience and connect with universities and students worldwide"}
          </p>
        </motion.div>

        {showEmptyState ? (
          /* Empty state - invite to community */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center py-14 rounded-2xl border border-border bg-card"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {isAr ? "انضم إلى المجتمع" : "Join the Community"}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {isAr
                ? "كن أول من يشارك تجربته! سجّل دخولك وابدأ بالنشر والتفاعل مع الجامعات والطلاب"
                : "Be the first to share! Sign in and start posting and interacting with universities and students"}
            </p>
            <Button onClick={() => navigate("/community")} className="gap-2">
              {isAr ? "ابدأ الآن" : "Get Started"}
              <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Posts preview grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                  variants={fadeUp}
                  onClick={() => navigate("/community")}
                  className={cn(
                    "group cursor-pointer rounded-xl border border-border/50 bg-card p-5",
                    "hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                  )}
                >
                  {/* Author */}
                  <div className="flex items-center gap-2.5 mb-3">
                    {post.author_type === "university" ? (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border flex-shrink-0">
                        {post.university_logo ? (
                          <img src={post.university_logo} alt="" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {post.author_type === "university"
                            ? (isAr ? post.university_name_ar || post.university_name : post.university_name) || (isAr ? "جامعة" : "University")
                            : post.author_name}
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
                          post.author_type === "university"
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-emerald-500/10 text-emerald-600"
                        )}>
                          {post.author_type === "university" ? (isAr ? "جامعة" : "Uni") : (isAr ? "طالب" : "Student")}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm text-foreground/85 line-clamp-3 leading-relaxed">
                    {post.content}
                  </p>

                  {/* Image preview */}
                  {post.image_url && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-border h-32">
                      <img src={post.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-border/50 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" />
                      {post.likes_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {post.comments_count}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <Button
                onClick={() => navigate("/community")}
                size="lg"
                variant="outline"
                className="gap-2"
              >
                {isAr ? "استكشف المجتمع" : "Explore Community"}
                <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
              </Button>
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
}
