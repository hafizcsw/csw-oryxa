import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Users, Globe, Award, Heart, Brain, Rocket, 
  GraduationCap, Building2, MapPin, Sparkles, 
  Bot, Database, TrendingUp, Shield, Zap, 
  BarChart3, Languages, Clock, Star, CheckCircle2,
  Network, Cpu, Eye, FileSearch, Workflow, 
  MessageSquare, Plane, CreditCard, Stethoscope,
  BookOpen, Target, ArrowRight, Quote, Play
} from "lucide-react";
import { motion } from "framer-motion";
import { DSButton } from "@/components/design-system/DSButton";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function About() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();

  const stats = [
    { value: "30+", labelAr: "دولة متاحة", labelEn: "Countries", icon: Globe },
    { value: "500+", labelAr: "جامعة شريكة", labelEn: "Universities", icon: GraduationCap },
    { value: "10,000+", labelAr: "برنامج أكاديمي", labelEn: "Programs", icon: BookOpen },
    { value: "50,000+", labelAr: "طالب خدمناه", labelEn: "Students Served", icon: Users },
    { value: "95%", labelAr: "نسبة نجاح التأشيرات", labelEn: "Visa Success Rate", icon: Shield },
    { value: "24/7", labelAr: "دعم متواصل", labelEn: "Support Available", icon: Clock },
  ];

  const aiFeatures = [
    { icon: Brain, titleAr: "محرك توصيات ذكي", titleEn: "Smart Recommendation Engine", descAr: "خوارزميات ذكاء اصطناعي تحلل ملفك الأكاديمي — معدلك، تخصصك، ميزانيتك، وطموحاتك — ثم تقارنها بقاعدة بيانات تضم أكثر من 10,000 برنامج لتقدم لك قائمة مخصصة بأفضل الخيارات بدقة تتجاوز 92%", descEn: "AI algorithms analyze your academic profile — GPA, major, budget, and ambitions — then compare against 10,000+ programs to deliver a personalized list with 92%+ accuracy" },
    { icon: Bot, titleAr: "ملك – المستشار الذكي", titleEn: "Malak – AI Counselor", descAr: "ليس مجرد شات بوت. ملك يفهم السياق، يتذكر محادثاتك السابقة، ويقدم نصائح مخصصة بناءً على ملفك. يتحدث العربية والإنجليزية بطلاقة ومتاح على مدار الساعة", descEn: "Not just a chatbot. Malak understands context, remembers previous conversations, and provides personalized advice. Fluent in Arabic and English, available 24/7" },
    { icon: Database, titleAr: "أضخم قاعدة بيانات تعليمية عربية", titleEn: "Largest Arabic Educational Database", descAr: "نُحدّث بياناتنا آلياً عبر زاحف ويب ذكي يجمع بيانات القبول، الرسوم، المنح، والتصنيفات من مواقع الجامعات مباشرةً — لا معلومات قديمة أبداً", descEn: "Auto-updated via smart web crawlers that collect admission data, fees, scholarships, and rankings directly from university websites — never outdated" },
    { icon: BarChart3, titleAr: "تحليل فرص القبول بالذكاء الاصطناعي", titleEn: "AI Admission Probability", descAr: "نموذج تعلم آلي مُدرّب على آلاف حالات القبول التاريخية يُقيّم فرص قبولك في كل جامعة ويُرتّبها من الأعلى للأقل احتمالاً", descEn: "ML model trained on thousands of historical admissions evaluates and ranks your acceptance probability at each university" },
    { icon: Zap, titleAr: "معالجة مستندات فورية", titleEn: "Instant Document Processing", descAr: "تقنيات OCR متقدمة تقرأ شهاداتك ووثائقك في ثوانٍ، تستخرج البيانات تلقائياً، وتُطابقها مع متطلبات الجامعات — بدون إدخال يدوي", descEn: "Advanced OCR reads your certificates in seconds, auto-extracts data, and matches against university requirements — zero manual entry" },
    { icon: TrendingUp, titleAr: "لوحة تتبع ذكية", titleEn: "Smart Tracking Dashboard", descAr: "تتابع حالة كل طلب في الوقت الفعلي مع تنبيهات ذكية عند كل تحديث، مواعيد نهائية قادمة، وخطوات مطلوبة منك", descEn: "Real-time tracking of every application with smart alerts for updates, upcoming deadlines, and required actions" },
    { icon: Network, titleAr: "شبكة بيانات مترابطة", titleEn: "Interconnected Data Network", descAr: "ربطنا بيانات الجامعات بتكاليف المعيشة، المناخ، الأمان، المواصلات، وجودة الحياة في كل مدينة — صورة شاملة لقرار مدروس", descEn: "University data linked with living costs, climate, safety, transport, and quality of life in every city — complete picture for informed decisions" },
    { icon: Eye, titleAr: "مراقبة جودة البيانات", titleEn: "Data Quality Monitoring", descAr: "نظام تحقق متعدد الطبقات يضمن دقة كل معلومة: تقييم آلي، مراجعة بشرية، وتحقق من المصادر الرسمية", descEn: "Multi-layer verification ensuring every data point is accurate: automated scoring, human review, and official source validation" },
    { icon: Cpu, titleAr: "بنية تحتية سحابية ضخمة", titleEn: "Massive Cloud Infrastructure", descAr: "منصتنا مبنية على بنية سحابية تعالج ملايين الطلبات يومياً بسرعة فائقة وأمان على مستوى المؤسسات", descEn: "Built on cloud infrastructure processing millions of requests daily with enterprise-grade speed and security" },
  ];

  const journeySteps = [
    { num: "01", titleAr: "اكتشف", titleEn: "Discover", descAr: "استكشف الجامعات والبرامج عبر منصتنا الذكية. فلاتر متقدمة، مقارنات فورية، وتوصيات مخصصة", descEn: "Explore universities and programs through our smart platform. Advanced filters, instant comparisons, and personalized recommendations", icon: Target },
    { num: "02", titleAr: "خطّط", titleEn: "Plan", descAr: "مستشارك الشخصي يبني معك خطة أكاديمية متكاملة — الجامعة، البرنامج، الميزانية، والجدول الزمني", descEn: "Your personal counselor builds a complete academic plan — university, program, budget, and timeline", icon: Workflow },
    { num: "03", titleAr: "قدّم", titleEn: "Apply", descAr: "نتولى تجهيز وتقديم ملفك الكامل — مستندات، رسائل توصية، خطابات تحفيزية — كل شيء نتكفل به", descEn: "We prepare and submit your complete application — documents, references, motivation letters — everything handled", icon: FileSearch },
    { num: "04", titleAr: "احصل على القبول", titleEn: "Get Accepted", descAr: "متابعة حثيثة لطلبك مع الجامعة حتى استلام خطاب القبول وتجهيز ملف التأشيرة", descEn: "Close follow-up with the university until you receive your acceptance letter and visa file preparation", icon: CheckCircle2 },
    { num: "05", titleAr: "سافر واستقر", titleEn: "Travel & Settle", descAr: "استقبال بالمطار، سكن جاهز، حساب بنكي، تأمين صحي، وتعريف بالمدينة — نبدأ معك حياتك الجديدة", descEn: "Airport pickup, ready housing, bank account, health insurance, and city orientation — we start your new life with you", icon: Plane },
    { num: "06", titleAr: "ندعمك حتى التخرج", titleEn: "Support Until Graduation", descAr: "لا ننتهي عند وصولك. دعم مستمر طوال فترة دراستك — أكاديمي، قانوني، ونفسي", descEn: "We don't stop at arrival. Continuous support throughout your studies — academic, legal, and emotional", icon: Award },
  ];

  const services = [
    { icon: GraduationCap, titleAr: "القبول الجامعي الشامل", titleEn: "Full University Admissions", descAr: "من اختيار الجامعة والتخصص، مروراً بتجهيز الملف الكامل، وحتى استلام القبول — نتولى كل شيء بدقة واحترافية", descEn: "From selecting the university and major, through complete file preparation, to receiving admission — we handle everything professionally" },
    { icon: Shield, titleAr: "التأشيرات والإقامة", titleEn: "Visas & Residence Permits", descAr: "فريق قانوني متخصص بنسبة نجاح تتجاوز 95%. نجهز ملفك، نحجز مواعيدك، ونتابع حتى استلام تأشيرتك", descEn: "Specialized legal team with 95%+ success rate. We prepare your file, book appointments, and follow up until you get your visa" },
    { icon: Building2, titleAr: "السكن الطلابي المُختار", titleEn: "Curated Student Housing", descAr: "خيارات سكن مُتحقق منها وقريبة من جامعتك — سكن جامعي، شقق مشتركة، أو استوديوهات — مع صور وتقييمات حقيقية", descEn: "Verified housing options near your university — dorms, shared apartments, or studios — with real photos and reviews" },
    { icon: MapPin, titleAr: "استقبال المطار والتوجيه", titleEn: "Airport Pickup & Orientation", descAr: "مرشد يتحدث لغتك يستقبلك بالمطار، يوصلك لسكنك، ويعرّفك على المدينة والمرافق الأساسية", descEn: "A guide who speaks your language greets you at the airport, takes you to your housing, and introduces you to the city" },
    { icon: Languages, titleAr: "دورات اللغة والتحضير", titleEn: "Language & Prep Courses", descAr: "دورات إنجليزية مكثفة، تحضير IELTS و TOEFL مع مدربين معتمدين، ودورات تحضيرية للجامعة (Foundation)", descEn: "Intensive English courses, IELTS & TOEFL prep with certified trainers, and university foundation programs" },
    { icon: CreditCard, titleAr: "الحساب البنكي والتأمين", titleEn: "Banking & Insurance", descAr: "نساعدك في فتح حساب بنكي دولي والحصول على تأمين صحي شامل قبل سفرك أو فور وصولك", descEn: "We help you open an international bank account and get comprehensive health insurance before or upon arrival" },
    { icon: Stethoscope, titleAr: "التأمين الصحي", titleEn: "Health Insurance", descAr: "خطط تأمين صحي مُصممة خصيصاً للطلاب الدوليين بأسعار تنافسية وتغطية شاملة", descEn: "Health insurance plans designed specifically for international students with competitive prices and comprehensive coverage" },
    { icon: MessageSquare, titleAr: "الدعم المستمر", titleEn: "Continuous Support", descAr: "فريق دعم متاح عبر واتساب والبريد الإلكتروني طوال فترة دراستك — لسنا مجرد شركة، نحن عائلتك بالخارج", descEn: "Support team available via WhatsApp and email throughout your studies — we're not just a company, we're your family abroad" },
  ];

  const testimonials = [
    { nameAr: "أحمد م.", nameEn: "Ahmed M.", countryAr: "طالب في بريطانيا", countryEn: "Student in UK", textAr: "كنت ضائعاً تماماً. CSW نظّموا كل شيء من القبول للسكن. وصلت لندن وكل شيء جاهز. فريق محترف فعلاً.", textEn: "I was completely lost. CSW organized everything from admission to housing. I arrived in London and everything was ready." },
    { nameAr: "سارة ع.", nameEn: "Sarah A.", countryAr: "طالبة في ماليزيا", countryEn: "Student in Malaysia", textAr: "المنصة الذكية ساعدتني أختار تخصص ما كنت أفكر فيه — وطلع الخيار الأفضل! شكراً ملك المستشار الذكي.", textEn: "The smart platform helped me choose a major I hadn't considered — and it turned out to be the best choice!" },
    { nameAr: "محمد ر.", nameEn: "Mohammed R.", countryAr: "طالب في تركيا", countryEn: "Student in Turkey", textAr: "تأشيرتي كانت معقدة جداً ورُفضت مرتين قبل كذا. فريق CSW القانوني حلّها من أول مرة. احترافية عالية.", textEn: "My visa was very complicated and was rejected twice before. CSW's legal team solved it on the first try." },
    { nameAr: "نورة ك.", nameEn: "Noura K.", countryAr: "طالبة في كندا", countryEn: "Student in Canada", textAr: "أكثر شي عجبني إنهم ما تركوني بعد ما وصلت. دعم مستمر حتى بعد سنة. فعلاً يحسسونك إنك مو لوحدك.", textEn: "What I loved most is they didn't leave me after arrival. Continuous support even after a year. They make you feel you're not alone." },
  ];

  const values = [
    { icon: Globe, titleAr: "انتشار عالمي حقيقي", titleEn: "True Global Reach", descAr: "لسنا شركة محلية تدّعي العالمية. لدينا شراكات موثقة مع 500+ جامعة في 30+ دولة ومكاتب تمثيل في عدة قارات", descEn: "We're not a local company claiming global reach. We have documented partnerships with 500+ universities in 30+ countries" },
    { icon: Sparkles, titleAr: "تقنية رائدة بلا منافس", titleEn: "Unmatched Technology", descAr: "أول منصة عربية تدمج الذكاء الاصطناعي، الزحف الآلي للبيانات، ونماذج التعلم الآلي في عملية الاستشارة التعليمية", descEn: "First Arabic platform integrating AI, automated web crawling, and ML models into educational consulting" },
    { icon: Users, titleAr: "فريق عاش التجربة", titleEn: "Team Who Lived It", descAr: "مستشارونا ليسوا موظفين فقط — هم طلاب سابقون درسوا بالخارج ويعرفون تحدياتك لأنهم عاشوها", descEn: "Our counselors aren't just employees — they're former international students who understand your challenges firsthand" },
    { icon: Heart, titleAr: "نجاحك هو مقياسنا", titleEn: "Your Success Is Our Metric", descAr: "لا نقيس نجاحنا بعدد العملاء بل بنسبة رضا طلابنا وتخرجهم — وهي تتجاوز 98%", descEn: "We don't measure success by client count but by student satisfaction and graduation rate — which exceeds 98%" },
  ];

  const techStack = [
    { labelAr: "ذكاء اصطناعي توليدي", labelEn: "Generative AI" },
    { labelAr: "تعلم آلي", labelEn: "Machine Learning" },
    { labelAr: "معالجة لغة طبيعية", labelEn: "NLP" },
    { labelAr: "زحف ويب ذكي", labelEn: "Smart Web Crawling" },
    { labelAr: "OCR متقدم", labelEn: "Advanced OCR" },
    { labelAr: "بيانات ضخمة", labelEn: "Big Data" },
    { labelAr: "تحليلات لحظية", labelEn: "Real-Time Analytics" },
    { labelAr: "بنية سحابية", labelEn: "Cloud Infrastructure" },
    { labelAr: "أمان مؤسسي", labelEn: "Enterprise Security" },
    { labelAr: "API مفتوح", labelEn: "Open API" },
  ];

  return (
    <Layout>
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background pt-20 pb-28">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div className="absolute top-10 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/[0.02] rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div className="text-center max-w-4xl mx-auto" initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold mb-8 backdrop-blur-sm">
              <Rocket className="w-4 h-4" />
              {isAr ? "مرحباً بك في Connect Study World" : "Welcome to Connect Study World"}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-foreground mb-6 leading-[1.1] tracking-tight">
              {isAr ? (
                <>لا نُرشد الطلاب فقط<br/><span className="text-primary">نحن نُعيد اختراع</span> كيف يدرسون بالخارج</>
              ) : (
                <>We Don't Just Guide Students<br/><span className="text-primary">We Reinvent</span> How They Study Abroad</>
              )}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto mb-10">
              {isAr
                ? "بنينا منصة تقنية ضخمة تجمع بين الذكاء الاصطناعي التوليدي، أكبر قاعدة بيانات تعليمية عربية، وفريق من المستشارين الذين عاشوا تجربة الدراسة بالخارج. النتيجة؟ تجربة لم يسبق لها مثيل — من الحلم الأول وحتى يوم التخرج."
                : "We've built a massive tech platform combining generative AI, the largest Arabic educational database, and counselors who've lived the study abroad experience. The result? An unprecedented journey — from the first dream to graduation day."}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <DSButton onClick={() => navigate("/contact")} size="lg" className="text-base px-8 py-3">
                {isAr ? "ابدأ رحلتك مجاناً" : "Start Your Journey Free"}
              </DSButton>
              <DSButton onClick={() => navigate("/universities")} variant="outline" size="lg" className="text-base px-8 py-3">
                {isAr ? "استكشف 10,000+ برنامج" : "Explore 10,000+ Programs"}
              </DSButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative -mt-14 z-20 max-w-6xl mx-auto px-4">
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1 bg-card rounded-2xl border-2 border-border shadow-2xl overflow-hidden"
          initial="hidden" whileInView="visible" viewport={{ once: true }}
        >
          {stats.map((s, i) => (
            <motion.div key={i} className="text-center py-6 px-4 border-l border-border first:border-l-0" variants={fadeUp} custom={i}>
              <s.icon className="w-5 h-5 text-primary mx-auto mb-2 opacity-60" />
              <div className="text-2xl sm:text-3xl font-black text-primary mb-0.5">{s.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{isAr ? s.labelAr : s.labelEn}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Mission & Vision ── */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div 
            className="relative bg-gradient-to-br from-primary/5 to-transparent rounded-3xl p-8 md:p-10 border border-primary/10 group hover:border-primary/25 transition-colors"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Rocket className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground mb-4">{isAr ? "رسالتنا" : "Our Mission"}</h2>
            <p className="text-muted-foreground leading-relaxed text-base mb-4">
              {isAr
                ? "تحويل تجربة الدراسة بالخارج من رحلة معقدة ومرهقة ومليئة بالمخاطر إلى تجربة سلسة وممتعة وآمنة. نؤمن أن كل طالب يستحق فرصة عادلة بغض النظر عن خلفيته أو موقعه الجغرافي."
                : "To transform the study abroad experience from a complex, exhausting, and risky journey into a seamless, enjoyable, and safe one. We believe every student deserves a fair chance regardless of background or location."}
            </p>
            <p className="text-muted-foreground leading-relaxed text-base">
              {isAr
                ? "نستخدم أحدث تقنيات الذكاء الاصطناعي لتحليل آلاف الخيارات في ثوانٍ، ونجمع بين قوة التكنولوجيا ودفء الإرشاد البشري لنقدم لكل طالب خارطة طريق مخصصة نحو مستقبله الأكاديمي."
                : "We use cutting-edge AI to analyze thousands of options in seconds, combining the power of technology with the warmth of human guidance to give every student a personalized roadmap to their academic future."}
            </p>
          </motion.div>
          <motion.div 
            className="relative bg-gradient-to-br from-accent/5 to-transparent rounded-3xl p-8 md:p-10 border border-accent/10 group hover:border-accent/25 transition-colors"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
          >
            <div className="absolute top-0 left-0 w-40 h-40 bg-accent/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
              <Star className="w-7 h-7 text-accent-foreground" />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground mb-4">{isAr ? "رؤيتنا 2030" : "Our Vision 2030"}</h2>
            <p className="text-muted-foreground leading-relaxed text-base mb-4">
              {isAr
                ? "أن نصبح المنصة الأولى عالمياً التي يلجأ إليها كل طالب طموح — ليس فقط كشركة استشارات، بل كشريك تقني ذكي يرافقه من الحلم الأول وحتى التخرج والتوظيف."
                : "To become the world's #1 platform every ambitious student turns to — not just as a consultancy, but as a smart tech partner from the first dream through graduation and employment."}
            </p>
            <p className="text-muted-foreground leading-relaxed text-base">
              {isAr
                ? "نبني مستقبلاً يكون فيه اختيار الجامعة المناسبة بنفس سهولة حجز رحلة طيران — عالم بلا حواجز تعليمية، حيث الموهبة وحدها هي ما يحدد مسارك."
                : "We're building a future where choosing the right university is as easy as booking a flight — a world without educational barriers, where talent alone determines your path."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── AI & Technology Section ── */}
      <section className="relative bg-gradient-to-b from-muted/40 to-background py-24 border-y border-border overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-3xl -translate-y-1/2" />
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold mb-5">
              <Brain className="w-4 h-4" />
              {isAr ? "قوة الذكاء الاصطناعي" : "Powered by AI"}
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-5">
              {isAr ? "تقنيات بُنيت لتغيير قواعد اللعبة" : "Technology Built to Change the Game"}
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {isAr
                ? "لم نستعر تقنية جاهزة. بنينا كل سطر كود بأنفسنا — من خوارزميات التوصية، مروراً بزاحف الويب الذكي، وحتى نماذج تحليل فرص القبول. بنية تقنية ضخمة تعالج بيانات أكثر من 10,000 برنامج أكاديمي في الوقت الفعلي."
                : "We didn't borrow existing technology. We built every line of code ourselves — from recommendation algorithms, through smart web crawlers, to admission probability models. A massive tech infrastructure processing 10,000+ academic programs in real-time."}
            </p>
          </motion.div>

          {/* Tech Stack Badges */}
          <motion.div className="flex flex-wrap justify-center gap-2 mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn}>
            {techStack.map((tech, i) => (
              <span key={i} className="px-4 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-primary text-xs font-semibold">
                {isAr ? tech.labelAr : tech.labelEn}
              </span>
            ))}
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {aiFeatures.map((f, i) => (
              <motion.div
                key={i}
                className="group bg-card rounded-2xl p-7 border border-border shadow-sm hover:shadow-xl hover:border-primary/25 transition-all duration-300 hover:-translate-y-1"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{isAr ? f.titleAr : f.titleEn}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{isAr ? f.descAr : f.descEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Student Journey ── */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-5">
            {isAr ? "رحلتك معنا — خطوة بخطوة" : "Your Journey With Us — Step by Step"}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isAr
              ? "من الفكرة الأولى وحتى تخرجك — كل مرحلة مُغطاة ومدعومة بفريقنا وتقنياتنا"
              : "From the first idea to graduation — every stage covered and supported by our team and technology"}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {journeySteps.map((step, i) => (
            <motion.div
              key={i}
              className="relative bg-card rounded-2xl p-7 border border-border shadow-sm group hover:shadow-lg transition-all duration-300"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl font-black text-primary/15 group-hover:text-primary/25 transition-colors">{step.num}</span>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{isAr ? step.titleAr : step.titleEn}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{isAr ? step.descAr : step.descEn}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Services ── */}
      <section className="bg-gradient-to-b from-muted/30 to-background py-24 border-y border-border">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-5">
              {isAr ? "خدمات شاملة — لا تحتاج أحداً غيرنا" : "Complete Services — You Don't Need Anyone Else"}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {isAr
                ? "كل ما يحتاجه الطالب الدولي تحت سقف واحد — لا وسطاء، لا تعقيدات، لا مفاجآت"
                : "Everything an international student needs under one roof — no middlemen, no complications, no surprises"}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((s, i) => (
              <motion.div
                key={i}
                className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg hover:border-primary/20 transition-all duration-300 hover:-translate-y-1"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2 text-sm">{isAr ? s.titleAr : s.titleEn}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{isAr ? s.descAr : s.descEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4">
            {isAr ? "طلابنا يتحدثون" : "Our Students Speak"}
          </h2>
          <p className="text-lg text-muted-foreground">
            {isAr ? "قصص حقيقية من طلاب حققوا أحلامهم معنا" : "Real stories from students who achieved their dreams with us"}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-all"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
            >
              <Quote className="w-8 h-8 text-primary/20 mb-3" />
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 min-h-[80px]">
                {isAr ? t.textAr : t.textEn}
              </p>
              <div className="border-t border-border pt-3">
                <p className="font-bold text-foreground text-sm">{isAr ? t.nameAr : t.nameEn}</p>
                <p className="text-xs text-muted-foreground">{isAr ? t.countryAr : t.countryEn}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Why Different ── */}
      <section className="bg-gradient-to-b from-background to-muted/20 py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-5">
              {isAr ? "لماذا نحن مختلفون — فعلاً؟" : "Why Are We Actually Different?"}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {isAr
                ? "الكلام سهل. الفرق الحقيقي يظهر في التفاصيل والنتائج"
                : "Talk is cheap. The real difference shows in details and results"}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <motion.div
                key={i}
                className="text-center p-8 rounded-3xl bg-card border border-border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <v.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-3">{isAr ? v.titleAr : v.titleEn}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{isAr ? v.descAr : v.descEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <motion.div 
          className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-3xl p-12 md:p-20 text-center"
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "30px 30px" }} />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-primary-foreground mb-5 leading-tight">
              {isAr ? "مستقبلك الأكاديمي يبدأ بقرار واحد" : "Your Academic Future Starts With One Decision"}
            </h2>
            <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto mb-10 leading-relaxed">
              {isAr
                ? "لا تنتظر أكثر. تواصل معنا اليوم واحصل على استشارة مجانية من فريقنا المتخصص. سنبني معك خطة أكاديمية مخصصة خلال 48 ساعة."
                : "Don't wait any longer. Contact us today for a free consultation from our expert team. We'll build you a personalized academic plan within 48 hours."}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <DSButton onClick={() => navigate("/contact")} variant="secondary" size="lg" className="bg-white text-primary hover:bg-white/90 font-bold text-base px-8">
                {isAr ? "احصل على استشارة مجانية" : "Get a Free Consultation"}
              </DSButton>
              <DSButton onClick={() => window.open("https://wa.me/79013561060", "_blank")} variant="outline" size="lg" className="border-white/30 text-primary-foreground hover:bg-white/10 text-base px-8">
                {isAr ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
              </DSButton>
            </div>
          </div>
        </motion.div>
      </section>
    </Layout>
  );
}
