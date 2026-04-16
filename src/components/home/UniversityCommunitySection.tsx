import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Users, MapPin, GraduationCap, ChevronRight, Building2 } from "lucide-react";
import { motion } from "framer-motion";

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

export function UniversityCommunitySection() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";
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
    return d.length > 120 ? d.slice(0, 120) + "…" : d;
  };

  const countryName = (u: UniPost) =>
    isAr ? u.country_name_ar || "" : u.country_name_en || "";

  return (
    <section className="py-16 px-6 bg-gradient-to-b from-muted/30 to-background" dir={isAr ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                {isAr ? "مجتمع الجامعات" : "University Community"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {isAr
                  ? "آخر أخبار ومنشورات الجامعات المتاحة في النظام"
                  : "Latest updates from universities in our system"}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/community")}
            className="group flex items-center gap-1.5 text-primary hover:text-primary/80 font-semibold text-sm transition-all"
          >
            {isAr ? "عرض الكل" : "View All"}
            <ChevronRight className={`w-4 h-4 transition-transform ${isAr ? "rotate-180 group-hover:-translate-x-1" : "group-hover:translate-x-1"}`} />
          </button>
        </div>

        {/* University Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {unis.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/university/${u.slug}`)}
              className="group cursor-pointer rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300"
            >
              {/* Hero / Logo Banner */}
              <div className="relative h-32 bg-gradient-to-br from-primary/5 to-accent/10 overflow-hidden">
                {u.hero_image_url ? (
                  <img
                    src={u.hero_image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="w-12 h-12 text-muted-foreground/20" />
                  </div>
                )}
                {/* Logo overlay */}
                {u.logo_url && (
                  <div className="absolute bottom-0 start-3 translate-y-1/2 w-14 h-14 rounded-xl bg-card border-2 border-background shadow-md overflow-hidden flex items-center justify-center p-1">
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
              <div className="p-4 pt-9">
                <h3 className="font-bold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
                  {uniName(u)}
                </h3>

                {/* Location */}
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="line-clamp-1">
                    {[u.city, countryName(u)].filter(Boolean).join("، ")}
                  </span>
                </div>

                {/* Description */}
                {uniDesc(u) && (
                  <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2 leading-relaxed">
                    {uniDesc(u)}
                  </p>
                )}

                {/* Stats row */}
                {u.enrolled_students && (
                  <div className="flex items-center gap-1 mt-3 text-[11px] text-muted-foreground">
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
      </div>
    </section>
  );
}
