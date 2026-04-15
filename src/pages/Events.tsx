import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, Video, MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function Events() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const upcomingEvents = [
    {
      title: isAr ? "ندوة: كيف تختار جامعتك المثالية" : "Webinar: How to Choose Your Ideal University",
      date: isAr ? "قريباً" : "Coming Soon",
      type: "online" as const,
      desc: isAr ? "جلسة تفاعلية مع مستشارين أكاديميين متخصصين" : "Interactive session with specialized academic counselors",
    },
    {
      title: isAr ? "معرض الجامعات الدولية" : "International Universities Fair",
      date: isAr ? "قريباً" : "Coming Soon",
      type: "hybrid" as const,
      desc: isAr ? "تعرف على أفضل الجامعات من حول العالم" : "Meet top universities from around the world",
    },
    {
      title: isAr ? "ورشة عمل: التقديم للمنح الدراسية" : "Workshop: Applying for Scholarships",
      date: isAr ? "قريباً" : "Coming Soon",
      type: "online" as const,
      desc: isAr ? "تعلم أسرار الحصول على المنح الدراسية" : "Learn the secrets to winning scholarships",
    },
  ];

  return (
    <Layout>
      <div dir={isAr ? "rtl" : "ltr"}>
        <section className="py-16 sm:py-24 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Calendar className="w-4 h-4" />
                {isAr ? "الفعاليات" : "Events"}
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
                {isAr ? "الفعاليات القادمة" : "Upcoming Events"}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {isAr ? "ندوات، معارض، وورش عمل لمساعدتك في رحلتك الأكاديمية" : "Webinars, fairs, and workshops to help you on your academic journey"}
              </p>
            </motion.div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-16">
          <div className="space-y-6">
            {upcomingEvents.map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: isAr ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {event.type === "online" ? <Video className="w-6 h-6 text-primary" /> : <MapPin className="w-6 h-6 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground mb-1">{event.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{event.desc}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {event.date}
                      </span>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        {event.type === "online" ? (isAr ? "أونلاين" : "Online") : (isAr ? "حضوري + أونلاين" : "Hybrid")}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
