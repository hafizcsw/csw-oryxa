import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Users, Building2, ArrowRight, Heart, MessageCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { isRtlLanguage } from "@/i18n/languages";

interface PreviewPost {
  id: string;
  author_type: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_name?: string;
  university_name?: string;
  university_name_ar?: string;
  university_logo?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function UniversityCommunitySection() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = isRtlLanguage(language);
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
          author_name: profile?.full_name || t("home.community.student"),
          university_name: uni?.name,
          university_name_ar: uni?.name_ar,
          university_logo: uni?.logo_url,
        };
      }));
      setLoading(false);
    })();
  }, [t]);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("home.community.now");
    if (mins < 60) return t("home.community.minAgo", { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("home.community.hourAgo", { n: hrs });
    const days = Math.floor(hrs / 24);
    return t("home.community.dayAgo", { n: days });
  };

  const getUniversityDisplayName = (post: PreviewPost): string => {
    if (language === "ar" && post.university_name_ar) return post.university_name_ar;
    return post.university_name || t("home.community.university");
  };

  const showEmptyState = !loading && posts.length === 0;

  return (
    <section className="relative py-28 md:py-36 px-6 bg-transparent overflow-hidden">
      <div className="max-w-[1280px] mx-auto">
        {/* Eyebrow + "First of its kind" marker */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          custom={0}
          variants={fadeUp}
          className="flex items-center justify-between gap-4 mb-12 flex-wrap"
        >
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-[var(--ag-border)]" />
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--ag-muted)]">
              {t("home.community.badge")}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--ag-border)] text-[11px] font-medium tracking-wide text-[var(--ag-muted)]">
            <Sparkles className="w-3 h-3" />
            <span className="font-mono tabular-nums">001</span>
            <span>—</span>
            <span>{t("home.community.firstOfItsKind")}</span>
          </div>
        </motion.div>

        {/* Editorial headline split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end mb-20">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            variants={fadeUp}
            className="lg:col-span-8 text-[clamp(2.4rem,6vw,5.25rem)] font-semibold tracking-[-0.025em] leading-[0.98] text-[var(--ag-fg)]"
          >
            {t("home.community.title")}
          </motion.h2>

          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
            variants={fadeUp}
            className="lg:col-span-4 text-base md:text-lg text-[var(--ag-muted)] leading-[1.7]"
          >
            {t("home.community.subtitle")}
          </motion.p>
        </div>

        {showEmptyState ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="border-t border-b border-[var(--ag-border)] py-20 px-6 text-center"
          >
            <h3 className="text-2xl md:text-3xl font-semibold tracking-[-0.01em] text-[var(--ag-fg)] mb-4">
              {t("home.community.joinTitle")}
            </h3>
            <p className="text-[var(--ag-muted)] max-w-lg mx-auto mb-8 leading-[1.7]">
              {t("home.community.joinDesc")}
            </p>
            <button
              onClick={() => navigate("/community")}
              className={cn(
                "group inline-flex items-center gap-3 px-7 py-3.5 rounded-full",
                "bg-[var(--ag-fg)] text-[var(--ag-bg)] text-sm font-medium tracking-wide",
                "hover:opacity-90 transition-opacity"
              )}
            >
              {t("home.community.getStarted")}
              <ArrowRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-1", isRTL && "rotate-180 group-hover:-translate-x-1")} />
            </button>
          </motion.div>
        ) : (
          <>
            {/* Posts grid — AG editorial cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-[var(--ag-border)]">
              {posts.map((post, i) => (
                <motion.button
                  key={post.id}
                  type="button"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-60px" }}
                  custom={i}
                  variants={fadeUp}
                  onClick={() => navigate("/community")}
                  className={cn(
                    "group text-left p-7 transition-colors duration-300",
                    "border-b border-[var(--ag-border)]",
                    "md:[&:nth-child(odd)]:border-r lg:[&:nth-child(odd)]:border-r-0",
                    "lg:[&:not(:nth-child(3n))]:border-r border-[var(--ag-border)]",
                    "hover:bg-[color-mix(in_srgb,var(--ag-fg)_4%,transparent)]"
                  )}
                >
                  {/* Meta row */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {post.author_type === "university" ? (
                        <div className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--ag-fg)_8%,transparent)] flex items-center justify-center overflow-hidden border border-[var(--ag-border)] flex-shrink-0">
                          {post.university_logo ? (
                            <img src={post.university_logo} alt="" className="w-full h-full object-contain p-1" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-[var(--ag-muted)]" />
                          )}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-[var(--ag-border)] flex items-center justify-center flex-shrink-0">
                          <Users className="w-3.5 h-3.5 text-[var(--ag-muted)]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--ag-fg)] truncate">
                          {post.author_type === "university"
                            ? getUniversityDisplayName(post)
                            : post.author_name}
                        </div>
                        <div className="text-[11px] text-[var(--ag-muted)] uppercase tracking-wider">
                          {post.author_type === "university"
                            ? t("home.community.uniShort")
                            : t("home.community.studentShort")}
                          {" · "}
                          {timeAgo(post.created_at)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--ag-muted)] tabular-nums flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="text-[15px] text-[var(--ag-fg)] line-clamp-4 leading-[1.65] mb-5">
                    {post.content}
                  </p>

                  {post.image_url && (
                    <div className="mb-5 rounded-md overflow-hidden border border-[var(--ag-border)] aspect-[16/9]">
                      <img src={post.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}

                  {/* Engagement */}
                  <div className="flex items-center gap-5 text-xs text-[var(--ag-muted)] font-mono tabular-nums">
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5" />
                      {post.likes_count}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {post.comments_count}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
              variants={fadeUp}
              className="mt-16 flex justify-center"
            >
              <button
                onClick={() => navigate("/community")}
                className={cn(
                  "group inline-flex items-center gap-3 px-8 py-4 rounded-full",
                  "border border-[var(--ag-border)] bg-transparent",
                  "text-[var(--ag-fg)] text-sm font-medium tracking-wide",
                  "hover:bg-[var(--ag-fg)] hover:text-[var(--ag-bg)]",
                  "transition-colors duration-300"
                )}
              >
                {t("home.community.explore")}
                <ArrowRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-1", isRTL && "rotate-180 group-hover:-translate-x-1")} />
              </button>
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
}
