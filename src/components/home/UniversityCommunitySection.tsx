import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Users, MapPin, GraduationCap, Building2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UniPost {
  id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  city: string | null;
  country_code: string | null;
  description: string | null;
  description_ar: string | null;
  enrolled_students: number | null;
  qs_world_rank: number | null;
  slug: string;
  country_name_ar?: string;
  country_name_en?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

export function UniversityCommunitySection() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";
  const isRTL = ["ar", "he", "fa", "ur"].includes(language);
  const [unis, setUnis] = useState<UniPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("universities")
        .select(`
          id, name, name_ar, name_en, logo_url, hero_image_url,
          city, country_code, description, description_ar,
          enrolled_students, qs_world_rank, slug,
          countries!universities_country_id_fkey ( name_ar, name_en )
        `)
        .eq("publish_status", "published")
        .eq("is_active", true)
        .not("logo_url", "is", null)
        .order("qs_world_rank", { ascending: true, nullsFirst: false })
        .limit(8);

      if (data) {
        setUnis(
          data.map((u: any) => ({
            ...u,
            country_name_ar: u.countries?.name_ar,
            country_name_en: u.countries?.name_en,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  if (loading || unis.length === 0) return null;

  const uniName = (u: UniPost) =>
    isAr ? u.name_ar || u.name : u.name_en || u.name;

  const uniDesc = (u: UniPost) => {
    const d = isAr ? u.description_ar || u.description : u.description;
    if (!d) return "";
    return d.length > 100 ? d.slice(0, 100) + "…" : d;
  };

  const countryName = (u: UniPost) =>
    isAr ? u.country_name_ar || "" : u.country_name_en || "";

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Header - matching other sections */}
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
            {isAr ? "مجتمع الجامعات" : "University Community"}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {isAr
              ? "تعرّف على أحدث الجامعات والمؤسسات التعليمية المتاحة في نظامنا"
              : "Discover the latest universities and institutions available in our system"}
          </p>
        </motion.div>

        {/* University Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {unis.map((u, i) => (
            <motion.div
              key={u.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              variants={fadeUp}
              onClick={() => navigate(`/university/${u.slug}`)}
              className={cn(
                "group cursor-pointer rounded-xl border border-border/50 bg-card overflow-hidden",
                "hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
              )}
            >
              {/* Hero Banner */}
              <div className="relative h-28 bg-gradient-to-br from-primary/5 to-accent/10 overflow-hidden">
                {u.hero_image_url ? (
                  <img
                    src={u.hero_image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-muted-foreground/15" />
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                {/* Logo overlay */}
                {u.logo_url && (
                  <div className="absolute bottom-0 start-3 translate-y-1/2 w-12 h-12 rounded-lg bg-card border-2 border-background shadow-md overflow-hidden flex items-center justify-center p-1">
                    <img
                      src={u.logo_url}
                      alt={uniName(u)}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                )}
                {/* QS Rank badge */}
                {u.qs_world_rank && (
                  <div className="absolute top-2 end-2 bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                    QS #{u.qs_world_rank}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 pt-8">
                <h3 className="font-semibold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
                  {uniName(u)}
                </h3>

                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="line-clamp-1">
                    {[u.city, countryName(u)].filter(Boolean).join("، ")}
                  </span>
                </div>

                {uniDesc(u) && (
                  <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2 leading-relaxed">
                    {uniDesc(u)}
                  </p>
                )}

                {u.enrolled_students && (
                  <div className="flex items-center gap-1 mt-3 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                    <GraduationCap className="w-3 h-3" />
                    <span>
                      {u.enrolled_students.toLocaleString()} {isAr ? "طالب" : "students"}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA - matching other sections */}
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
      </div>
    </section>
  );
}
