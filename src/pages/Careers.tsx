import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import {
  Briefcase, MapPin, Clock, Users, Heart, Rocket,
  GraduationCap, Globe, Zap, Shield, Star, ArrowRight,
  Send, Coffee, TrendingUp, Sparkles, Building2, Plane,
  Brain, Megaphone, Code, Network
} from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

interface JobPosting {
  titleAr: string;
  titleEn: string;
  locationAr: string;
  locationEn: string;
  typeAr: string;
  typeEn: string;
  departmentAr: string;
  departmentEn: string;
  descAr: string;
  descEn: string;
  tags: string[];
}

const openPositions: JobPosting[] = [
  {
    titleAr: "مطور ذكاء اصطناعي",
    titleEn: "AI Developer",
    locationAr: "عن بُعد",
    locationEn: "Remote",
    typeAr: "دوام كامل",
    typeEn: "Full-time",
    departmentAr: "الذكاء الاصطناعي",
    departmentEn: "AI",
    descAr: "بناء وتطوير نماذج الذكاء الاصطناعي وأنظمة التعلم الآلي لمنصاتنا التعليمية",
    descEn: "Build and develop AI models and machine learning systems for our education platforms",
    tags: ["Python", "LLM", "ML", "NLP"],
  },
  {
    titleAr: "أخصائي تسويق رقمي وأتمتة",
    titleEn: "Digital Marketing & Automation Specialist",
    locationAr: "عن بُعد / دبي",
    locationEn: "Remote / Dubai",
    typeAr: "دوام كامل",
    typeEn: "Full-time",
    departmentAr: "التسويق التقني",
    departmentEn: "Marketing Tech",
    descAr: "إدارة حملات التسويق الرقمي وأتمتة العمليات التسويقية باستخدام أدوات الذكاء الاصطناعي",
    descEn: "Manage digital marketing campaigns and automate marketing workflows using AI tools",
    tags: ["MarTech", "Automation", "AI", "Analytics"],
  },
  {
    titleAr: "مطور منصات تقنية",
    titleEn: "Platform Developer",
    locationAr: "عن بُعد",
    locationEn: "Remote",
    typeAr: "دوام كامل",
    typeEn: "Full-time",
    departmentAr: "الهندسة",
    departmentEn: "Engineering",
    descAr: "بناء وتطوير منصاتنا الرقمية باستخدام React و TypeScript وتقنيات السحابة",
    descEn: "Build and develop our digital platforms using React, TypeScript, and cloud technologies",
    tags: ["React", "TypeScript", "Supabase", "AI"],
  },
  {
    titleAr: "مندوب استقبال في المطارات",
    titleEn: "Airport Welcome Representative",
    locationAr: "متعدد المدن",
    locationEn: "Multiple Cities",
    typeAr: "تعاقد / جزئي",
    typeEn: "Contract / Part-time",
    departmentAr: "خدمات الاستقبال",
    departmentEn: "Reception Services",
    descAr: "استقبال الطلاب الدوليين في المطارات ومساعدتهم في الوصول إلى مقار إقامتهم بسلاسة",
    descEn: "Welcome international students at airports and assist them with smooth transit to their accommodation",
    tags: ["Hospitality", "Languages", "Logistics"],
  },
];

const ecosystemProducts = [
  { name: "ORYXA", icon: Building2 },
  { name: "ORX", icon: Zap },
  { name: "Oryxa Brain", icon: Brain },
  { name: "Pitch Navigator", icon: Rocket },
  { name: "Investor Room", icon: TrendingUp },
  { name: "VIPP", icon: Star },
  { name: "CSW AI CRM", icon: Users },
  { name: "Luxury Real Estate AI", icon: Sparkles },
  { name: "Plumb AI", icon: Brain },
  { name: "All 2 One", icon: Network },
];

const benefits = [
  { icon: Globe, titleAr: "عمل عن بُعد", titleEn: "Remote Work", descAr: "اعمل من أي مكان في العالم", descEn: "Work from anywhere in the world" },
  { icon: TrendingUp, titleAr: "نمو مهني", titleEn: "Career Growth", descAr: "فرص تطوير وترقي مستمرة", descEn: "Continuous development & promotion opportunities" },
  { icon: Heart, titleAr: "تأمين صحي", titleEn: "Health Insurance", descAr: "تغطية صحية شاملة لك ولعائلتك", descEn: "Comprehensive health coverage for you & family" },
  { icon: Coffee, titleAr: "بيئة مرنة", titleEn: "Flexible Culture", descAr: "ساعات عمل مرنة وإجازات سخية", descEn: "Flexible hours & generous time off" },
  { icon: GraduationCap, titleAr: "تعليم مستمر", titleEn: "Learning Budget", descAr: "ميزانية تعليمية سنوية للدورات والمؤتمرات", descEn: "Annual learning budget for courses & conferences" },
  { icon: Sparkles, titleAr: "مكافآت الأداء", titleEn: "Performance Bonus", descAr: "مكافآت ربع سنوية بناءً على الأداء", descEn: "Quarterly bonuses based on performance" },
];

const values = [
  { icon: Rocket, titleAr: "التأثير الحقيقي", titleEn: "Real Impact", descAr: "نغير حياة آلاف الطلاب حول العالم كل يوم", descEn: "We change thousands of students' lives worldwide every day" },
  { icon: Users, titleAr: "فريق متنوع", titleEn: "Diverse Team", descAr: "فريق من 15+ جنسية يعمل معاً بانسجام", descEn: "A team of 15+ nationalities working in harmony" },
  { icon: Zap, titleAr: "تقنية متقدمة", titleEn: "Cutting-edge Tech", descAr: "نستخدم الذكاء الاصطناعي وأحدث التقنيات", descEn: "We use AI and the latest technologies" },
  { icon: Shield, titleAr: "ثقافة الثقة", titleEn: "Trust Culture", descAr: "نثق بفريقنا ونمنحهم الاستقلالية الكاملة", descEn: "We trust our team and give them full autonomy" },
];

const internships = [
  { titleAr: "تدريب في الاستشارات التعليمية", titleEn: "Educational Consulting Internship", durationAr: "3-6 أشهر", durationEn: "3-6 months", descAr: "تعلم أساسيات الاستشارات التعليمية والقبول الجامعي", descEn: "Learn educational consulting & university admissions fundamentals" },
  { titleAr: "تدريب في تطوير البرمجيات", titleEn: "Software Development Internship", durationAr: "3-6 أشهر", durationEn: "3-6 months", descAr: "اكتسب خبرة عملية في بناء منصات تقنية حديثة", descEn: "Gain hands-on experience building modern tech platforms" },
  { titleAr: "تدريب في التسويق وإنشاء المحتوى", titleEn: "Marketing & Content Internship", durationAr: "3-6 أشهر", durationEn: "3-6 months", descAr: "ساهم في بناء حضورنا الرقمي والمحتوى التعليمي", descEn: "Contribute to building our digital presence & educational content" },
];

export default function Careers() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  return (
    <Layout>
      <div className="min-h-screen" dir={isAr ? "rtl" : "ltr"}>

        {/* ── Hero ── */}
        <section className="relative py-24 md:py-32 bg-secondary text-secondary-foreground overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/30 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          </div>
          <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-semibold mb-6">
                <Briefcase className="w-4 h-4" />
                {isAr ? "انضم إلى فريقنا" : "Join Our Team"}
              </span>
            </motion.div>
            <motion.h1
              className="text-4xl md:text-6xl font-extrabold leading-tight mb-6"
              initial="hidden" animate="visible" variants={fadeUp} custom={1}
            >
              {isAr ? (
                <>انضم لفريق يبني <span className="text-primary">منتجات تقنية عالمية</span></>
              ) : (
                <>Join a Team Building <span className="text-primary">Global Tech Products</span></>
              )}
            </motion.h1>
            <motion.p
              className="text-lg md:text-xl text-secondary-foreground/70 max-w-2xl mx-auto mb-10"
              initial="hidden" animate="visible" variants={fadeUp} custom={2}
            >
              {isAr
                ? "نبحث عن مبدعين في الذكاء الاصطناعي والتسويق التقني للانضمام لمنظومة CSW Global عبر 30+ دولة."
                : "We're looking for AI and MarTech talent to join the CSW Global ecosystem operating across 30+ countries."}
            </motion.p>
            <motion.div
              className="flex flex-wrap justify-center gap-4"
              initial="hidden" animate="visible" variants={fadeUp} custom={3}
            >
              <DSButton size="lg" onClick={() => document.getElementById('positions')?.scrollIntoView({ behavior: 'smooth' })}>
                {isAr ? "تصفح الوظائف" : "Browse Positions"}
                <ArrowRight className={`w-5 h-5 ${isAr ? 'rotate-180 mr-2' : 'ml-2'}`} />
              </DSButton>
              <DSButton variant="outline" size="lg" className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => document.getElementById('ecosystem')?.scrollIntoView({ behavior: 'smooth' })}>
                {isAr ? "منظومتنا" : "Our Ecosystem"}
              </DSButton>
            </motion.div>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="bg-primary text-primary-foreground py-6">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-3 gap-6 text-center">
              {[
                { val: "30+", labelAr: "دولة", labelEn: "Countries" },
                { val: "15+", labelAr: "جنسية", labelEn: "Nationalities" },
                { val: "13+", labelAr: "منتج وشركة", labelEn: "Products & Companies" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-2xl md:text-3xl font-extrabold">{s.val}</div>
                  <div className="text-sm opacity-80">{isAr ? s.labelAr : s.labelEn}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Our Ecosystem (CSW Global parent) ── */}
        <section id="ecosystem" className="py-20 md:py-28 bg-background">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div className="text-center mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                <Network className="w-4 h-4" />
                {isAr ? "منظومة CSW Global" : "CSW Global Ecosystem"}
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {isAr ? "شركاؤنا ومنتجاتنا" : "Our Partners & Products"}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {isAr
                  ? "CSW Global هي الشركة الأم لمنظومة متكاملة من المنتجات والمنصات التقنية المبتكرة"
                  : "CSW Global is the parent company of an integrated ecosystem of innovative tech products and platforms"}
              </p>
            </motion.div>

            {/* CSW Global — Parent highlight */}
            <motion.div
              className="mb-10 p-8 rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-primary/5 text-center relative overflow-hidden"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
              <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-extrabold text-foreground mb-2">CSW Global</h3>
              <p className="text-muted-foreground max-w-lg mx-auto">
                {isAr
                  ? "الشركة الأم — تجمع وتدير جميع منتجاتنا وشركاتنا التقنية تحت مظلة واحدة"
                  : "The parent company — uniting and managing all our tech products and companies under one umbrella"}
              </p>
            </motion.div>

            {/* Subsidiary products grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {ecosystemProducts.map((product, i) => (
                <motion.div
                  key={product.name}
                  className="p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all text-center group"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                    <product.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-bold text-foreground text-sm">{product.name}</h4>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Work With Us ── */}
        <section id="why-us" className="py-20 md:py-28 bg-muted/30">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {isAr ? "لماذا تعمل معنا؟" : "Why Work With Us?"}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {isAr
                  ? "نحن لسنا مجرد شركة — نحن مهمة. كل يوم نساعد طلاباً في تحقيق أحلامهم."
                  : "We're not just a company — we're a mission. Every day we help students achieve their dreams."}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6 mb-16">
              {values.map((v, i) => (
                <motion.div
                  key={i}
                  className="flex gap-5 p-6 rounded-2xl border border-border bg-card hover:shadow-lg transition-shadow"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <v.icon className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{isAr ? v.titleAr : v.titleEn}</h3>
                    <p className="text-muted-foreground text-sm">{isAr ? v.descAr : v.descEn}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.h3
              className="text-2xl font-bold text-foreground text-center mb-10"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            >
              {isAr ? "المزايا والمكافآت" : "Benefits & Perks"}
            </motion.h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {benefits.map((b, i) => (
                <motion.div
                  key={i}
                  className="p-5 rounded-xl border border-border bg-card text-center hover:border-primary/30 transition-colors"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <b.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-bold text-foreground mb-1">{isAr ? b.titleAr : b.titleEn}</h4>
                  <p className="text-muted-foreground text-sm">{isAr ? b.descAr : b.descEn}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Open Positions ── */}
        <section id="positions" className="py-20 md:py-28 bg-background">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div className="text-center mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {isAr ? "الوظائف المتاحة" : "Open Positions"}
              </h2>
              <p className="text-muted-foreground text-lg">
                {isAr ? "اختر الدور المناسب لك وابدأ رحلتك معنا" : "Choose the right role and start your journey with us"}
              </p>
            </motion.div>

            <div className="space-y-4">
              {openPositions.map((job, i) => (
                <motion.div
                  key={i}
                  className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-lg transition-all"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {isAr ? job.titleAr : job.titleEn}
                      </h3>
                      <p className="text-muted-foreground text-sm mt-1 mb-3">
                        {isAr ? job.descAr : job.descEn}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {isAr ? job.locationAr : job.locationEn}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {isAr ? job.typeAr : job.typeEn}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" /> {isAr ? job.departmentAr : job.departmentEn}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {job.tags.map((tag) => (
                          <span key={tag} className="px-2.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <DSButton
                      size="sm"
                      onClick={() => window.open(`mailto:hr@csworld.org?subject=${encodeURIComponent(isAr ? job.titleAr : job.titleEn)}`, '_blank')}
                    >
                      <Send className={`w-4 h-4 ${isAr ? 'ml-2' : 'mr-2'}`} />
                      {isAr ? "قدّم الآن" : "Apply Now"}
                    </DSButton>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Internships ── */}
        <section id="internships" className="py-20 md:py-28 bg-muted/30">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div className="text-center mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                <GraduationCap className="w-4 h-4" />
                {isAr ? "للطلاب والخريجين الجدد" : "For Students & Fresh Graduates"}
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {isAr ? "برامج التدريب" : "Internship Programs"}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {isAr
                  ? "ابدأ مسيرتك المهنية معنا. تدريب عملي حقيقي مع إمكانية التوظيف بعد الانتهاء."
                  : "Start your career with us. Real hands-on training with potential full-time offers upon completion."}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {internships.map((intern, i) => (
                <motion.div
                  key={i}
                  className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all text-center"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Star className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{isAr ? intern.titleAr : intern.titleEn}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{isAr ? intern.descAr : intern.descEn}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                    <Clock className="w-3 h-3" /> {isAr ? intern.durationAr : intern.durationEn}
                  </span>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="text-center mt-12"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={4}
            >
              <DSButton
                size="lg"
                onClick={() => window.open('mailto:hr@csworld.org?subject=Internship Application', '_blank')}
              >
                <Send className={`w-5 h-5 ${isAr ? 'ml-2' : 'mr-2'}`} />
                {isAr ? "تقدم لبرنامج التدريب" : "Apply for Internship"}
              </DSButton>
            </motion.div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 bg-secondary text-secondary-foreground">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <motion.h2
              className="text-3xl md:text-4xl font-extrabold mb-4"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            >
              {isAr ? "لم تجد الوظيفة المناسبة؟" : "Didn't find the right role?"}
            </motion.h2>
            <motion.p
              className="text-secondary-foreground/70 text-lg mb-8"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            >
              {isAr
                ? "أرسل سيرتك الذاتية وسنتواصل معك عندما تتوفر فرصة مناسبة لك."
                : "Send us your CV and we'll reach out when a suitable opportunity arises."}
            </motion.p>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}>
              <DSButton
                size="lg"
                onClick={() => window.open('mailto:hr@csworld.org?subject=General Application', '_blank')}
              >
                <Send className={`w-5 h-5 ${isAr ? 'ml-2' : 'mr-2'}`} />
                {isAr ? "أرسل سيرتك الذاتية" : "Send Your CV"}
              </DSButton>
            </motion.div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
