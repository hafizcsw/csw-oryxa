import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Users, MessageCircle, Heart, Share2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Community() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const features = [
    {
      icon: MessageCircle,
      title: isAr ? "منتدى الطلاب" : "Student Forum",
      desc: isAr ? "تواصل مع طلاب من جميع أنحاء العالم وشارك تجاربك" : "Connect with students worldwide and share experiences",
    },
    {
      icon: Heart,
      title: isAr ? "مجموعات الدعم" : "Support Groups",
      desc: isAr ? "انضم لمجموعات طلابية حسب الدولة أو التخصص" : "Join student groups by country or specialization",
    },
    {
      icon: Share2,
      title: isAr ? "قصص النجاح" : "Success Stories",
      desc: isAr ? "اقرأ قصص ملهمة من طلاب حققوا أحلامهم" : "Read inspiring stories from students who achieved their dreams",
    },
  ];

  return (
    <Layout>
      <div dir={isAr ? "rtl" : "ltr"}>
        <section className="py-16 sm:py-24 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Users className="w-4 h-4" />
                {isAr ? "المجتمع" : "Community"}
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
                {isAr ? "مجتمع الطلاب" : "Student Community"}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {isAr ? "انضم لمجتمعنا المتنامي من الطلاب الطموحين حول العالم" : "Join our growing community of ambitious students worldwide"}
              </p>
            </motion.div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="grid sm:grid-cols-3 gap-6 mb-16">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-xl p-6 text-center hover:shadow-md transition-shadow"
              >
                <f.icon className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center py-16 bg-muted/30 rounded-2xl border border-border">
            <Users className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {isAr ? "قريباً..." : "Coming Soon..."}
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {isAr ? "نعمل على بناء منصة مجتمعية متكاملة للطلاب. ترقبوا!" : "We're building a comprehensive community platform for students. Stay tuned!"}
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
