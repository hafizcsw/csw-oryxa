import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Brain, TrendingUp, Shield, Target, Lightbulb, Globe, 
  GraduationCap, BarChart3, Cpu, Users, Rocket, BookOpen,
  Sparkles, ArrowRight, CheckCircle2, AlertTriangle, Zap,
  Building2, Award, LineChart, ExternalLink, Quote, Briefcase,
  Heart, Eye, Clock, Star, TrendingDown, Layers
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { DSButton } from "@/components/design-system/DSButton";

const fadeUp = { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } };

function SourceBadge({ source, url, isAr }: { source: string; url: string; isAr: boolean }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full transition-colors border border-border/50">
      <ExternalLink className="w-3 h-3" />
      {isAr ? "المصدر:" : "Source:"} {source}
    </a>
  );
}

function QuoteBlock({ quote, author, role, isAr }: { quote: string; author: string; role: string; isAr: boolean }) {
  return (
    <div className="relative bg-card border border-border rounded-2xl p-6 sm:p-8">
      <Quote className="w-8 h-8 text-primary/20 absolute top-4 right-4 rtl:left-4 rtl:right-auto" />
      <p className="text-foreground italic leading-relaxed mb-4 text-lg">"{quote}"</p>
      <div>
        <span className="font-bold text-foreground">{author}</span>
        <span className="text-muted-foreground text-sm block">{role}</span>
      </div>
    </div>
  );
}

export default function Blog() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  return (
    <Layout>
      <div dir={isAr ? "rtl" : "ltr"}>
        {/* Hero */}
        <section className="relative py-20 sm:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-accent/5 to-transparent" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-20 left-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-1/3 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          </div>
          
          <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
            <motion.div {...fadeUp}>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-full text-sm font-semibold mb-8">
                <Sparkles className="w-4 h-4" />
                {isAr ? "الأخبار والمقالات" : "News & Articles"}
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                {isAr ? (
                  <>العالم يتغير...<br /><span className="text-primary">هل أنت مستعد؟</span></>
                ) : (
                  <>The World is Changing...<br /><span className="text-primary">Are You Ready?</span></>
                )}
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-6">
                {isAr
                  ? "الذكاء الاصطناعي يعيد تشكيل سوق العمل. ملايين الوظائف تتحول. التعليم الذكي هو مفتاحك للمستقبل. نحن هنا لنضعك على الطريق الصحيح."
                  : "AI is reshaping the job market. Millions of jobs are transforming. Smart education is your key to the future. We're here to set you on the right path."}
              </p>
              
              <div className="flex flex-wrap justify-center gap-2">
                <SourceBadge source="World Economic Forum" url="https://www.weforum.org/reports/the-future-of-jobs-report-2025" isAr={isAr} />
                <SourceBadge source="McKinsey Global Institute" url="https://www.mckinsey.com/featured-insights/future-of-work" isAr={isAr} />
                <SourceBadge source="Goldman Sachs Research" url="https://www.goldmansachs.com/insights/articles/generative-ai-could-raise-global-gdp-by-7-percent" isAr={isAr} />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ====== THE AI DISRUPTION - DEEP DIVE ====== */}
        <section className="max-w-7xl mx-auto px-4 py-16">
          <motion.div {...fadeUp} className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                {isAr ? "الاضطراب الكبير: لماذا لا يمكنك تجاهل ما يحدث" : "The Great Disruption: Why You Can't Ignore What's Happening"}
              </h2>
            </div>
            <p className="text-muted-foreground text-lg max-w-4xl leading-relaxed">
              {isAr
                ? "وفقاً لتقرير مستقبل الوظائف 2025 الصادر عن المنتدى الاقتصادي العالمي (WEF)، سيتم إلغاء 92 مليون وظيفة وإنشاء 170 مليون وظيفة جديدة بحلول 2030 — أي صافي إيجابي قدره 78 مليون وظيفة، لكن فقط لمن يمتلكون المهارات الصحيحة."
                : "According to the World Economic Forum's Future of Jobs Report 2025, 92 million jobs will be displaced and 170 million new jobs created by 2030 — a net positive of 78 million, but only for those with the right skills."}
            </p>
            <div className="mt-3">
              <SourceBadge source="WEF Future of Jobs 2025" url="https://www.weforum.org/publications/the-future-of-jobs-report-2025/" isAr={isAr} />
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* The Numbers */}
            <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-destructive to-destructive/50" />
              <Cpu className="w-10 h-10 text-destructive mb-4" />
              <h3 className="text-2xl font-bold text-foreground mb-4">
                {isAr ? "الأرقام التي لا تكذب" : "Numbers That Don't Lie"}
              </h3>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  {isAr
                    ? "دراسة Goldman Sachs تشير إلى أن الذكاء الاصطناعي التوليدي وحده قادر على أتمتة ما يعادل 300 مليون وظيفة بدوام كامل عالمياً. ليس خلال عقود — بل خلال السنوات القليلة القادمة."
                    : "A Goldman Sachs study indicates that generative AI alone could automate the equivalent of 300 million full-time jobs globally. Not in decades — in the next few years."}
                </p>
                <p>
                  {isAr
                    ? "تقرير McKinsey يكشف أن 375 مليون عامل (14% من القوى العاملة العالمية) سيحتاجون لتغيير فئتهم المهنية بالكامل. المحاسبة، القانون، البرمجة التقليدية، خدمة العملاء — كلها في مرمى النار."
                    : "McKinsey's report reveals that 375 million workers (14% of the global workforce) will need to switch occupational categories entirely. Accounting, law, traditional programming, customer service — all in the crosshairs."}
                </p>
                
                <div className="grid grid-cols-2 gap-3 pt-4">
                  {[
                    { num: isAr ? "٣٠٠M" : "300M", label: isAr ? "وظيفة مهددة بالأتمتة" : "Jobs threatened", src: "Goldman Sachs" },
                    { num: isAr ? "٩٢M" : "92M", label: isAr ? "وظيفة ستُلغى بحلول 2030" : "Jobs displaced by 2030", src: "WEF" },
                    { num: isAr ? "١٧٠M" : "170M", label: isAr ? "وظيفة جديدة ستظهر" : "New jobs emerging", src: "WEF" },
                    { num: isAr ? "٦٠٪" : "60%", label: isAr ? "من الوظائف ستتأثر" : "Of jobs will be affected", src: "IMF" },
                  ].map((s, i) => (
                    <div key={i} className="bg-destructive/5 rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-destructive">{s.num}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                      <div className="text-[10px] text-muted-foreground/60 mt-1">— {s.src}</div>
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                  <SourceBadge source="Goldman Sachs" url="https://www.goldmansachs.com/insights/articles/generative-ai-could-raise-global-gdp-by-7-percent" isAr={isAr} />
                  <SourceBadge source="IMF Report" url="https://www.imf.org/en/Blogs/Articles/2024/01/14/ai-will-transform-the-global-economy-lets-make-sure-it-benefits-humanity" isAr={isAr} />
                </div>
              </div>
            </motion.div>

            {/* The Opportunity */}
            <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
              <Rocket className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-2xl font-bold text-foreground mb-4">
                {isAr ? "الجانب المشرق: فرص غير مسبوقة" : "The Bright Side: Unprecedented Opportunities"}
              </h3>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  {isAr
                    ? "حسب تقرير LinkedIn لعام 2024، ظهرت أكثر من 50 مسمى وظيفي جديد لم يكن موجوداً قبل 5 سنوات: مهندس أوامر AI، أخلاقيات الذكاء الاصطناعي، مصمم تجربة AI، مدير بيانات تركيبية. الرواتب في هذه المجالات أعلى بـ 47% من المتوسط."
                    : "According to LinkedIn's 2024 report, over 50 new job titles emerged that didn't exist 5 years ago: AI Prompt Engineer, AI Ethics Officer, AI UX Designer, Synthetic Data Manager. Salaries in these fields are 47% above average."}
                </p>
                <p>
                  {isAr
                    ? "تقرير PwC يقدر أن الذكاء الاصطناعي سيضيف 15.7 تريليون دولار للاقتصاد العالمي بحلول 2030. الصين والولايات المتحدة ستستحوذان على 70% من هذه المكاسب — لكن الفرصة مفتوحة لمن يستعد الآن."
                    : "PwC's report estimates AI will add $15.7 trillion to the global economy by 2030. China and the US will capture 70% of these gains — but the opportunity is open to those who prepare now."}
                </p>
                
                <div className="grid grid-cols-2 gap-3 pt-4">
                  {[
                    { num: "$15.7T", label: isAr ? "إضافة للاقتصاد العالمي" : "Added to global GDP", src: "PwC" },
                    { num: "+47%", label: isAr ? "رواتب أعلى في وظائف AI" : "Higher AI job salaries", src: "LinkedIn" },
                    { num: "50+", label: isAr ? "مسمى وظيفي جديد" : "New job titles", src: "LinkedIn" },
                    { num: "2X", label: isAr ? "نمو الطلب على مهارات AI" : "AI skills demand growth", src: "Coursera" },
                  ].map((s, i) => (
                    <div key={i} className="bg-primary/5 rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-primary">{s.num}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                      <div className="text-[10px] text-muted-foreground/60 mt-1">— {s.src}</div>
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                  <SourceBadge source="PwC AI Report" url="https://www.pwc.com/gx/en/issues/artificial-intelligence.html" isAr={isAr} />
                  <SourceBadge source="LinkedIn Jobs Report" url="https://economicgraph.linkedin.com/research/future-of-work-report-ai" isAr={isAr} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Expert Quotes */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
              <QuoteBlock
                quote={isAr
                  ? "الذكاء الاصطناعي لن يحل محلك. لكن شخصاً يستخدم الذكاء الاصطناعي سيحل محلك."
                  : "AI won't replace you. But a person using AI will replace you."}
                author={isAr ? "كريستينا مونتغمري" : "Christina Montgomery"}
                role={isAr ? "نائبة رئيس IBM للخصوصية والثقة" : "VP of Privacy & Trust, IBM"}
                isAr={isAr}
              />
            </motion.div>
            <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
              <QuoteBlock
                quote={isAr
                  ? "في السنوات العشر القادمة، سنشهد تغييرات أكثر مما شهدناه في المائة سنة الماضية."
                  : "In the next 10 years, we'll see more change than in the past 100 years."}
                author={isAr ? "بيل غيتس" : "Bill Gates"}
                role={isAr ? "مؤسس مايكروسوفت" : "Co-founder, Microsoft"}
                isAr={isAr}
              />
            </motion.div>
          </div>
        </section>

        {/* ====== WHICH JOBS ARE AT RISK ====== */}
        <section className="bg-muted/30 py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                {isAr ? "أي الوظائف في خطر؟ وأيها ستزدهر؟" : "Which Jobs Are at Risk? And Which Will Thrive?"}
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-3">
                {isAr
                  ? "وفقاً لتحليل Oxford Economics و McKinsey، الوظائف الروتينية والمعرفية التكرارية هي الأكثر عرضة. لكن الوظائف الإبداعية والاستراتيجية والتي تتطلب تفاعلاً بشرياً عميقاً ستنمو."
                  : "According to Oxford Economics and McKinsey analysis, routine and repetitive knowledge jobs are most vulnerable. But creative, strategic, and deeply human-interactive roles will grow."}
              </p>
              <SourceBadge source="Oxford Economics" url="https://www.oxfordeconomics.com/resource/how-robots-change-the-world/" isAr={isAr} />
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* At Risk */}
              <motion.div {...fadeUp} className="bg-card border border-destructive/20 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingDown className="w-6 h-6 text-destructive" />
                  <h3 className="text-xl font-bold text-foreground">{isAr ? "وظائف في تراجع" : "Declining Jobs"}</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { job: isAr ? "إدخال البيانات" : "Data Entry", risk: "95%", reason: isAr ? "أتمتة كاملة بالذكاء الاصطناعي" : "Full AI automation" },
                    { job: isAr ? "المحاسبة التقليدية" : "Traditional Accounting", risk: "85%", reason: isAr ? "برامج المحاسبة الذكية" : "Smart accounting software" },
                    { job: isAr ? "خدمة العملاء (المستوى الأول)" : "Customer Service (Level 1)", risk: "80%", reason: isAr ? "روبوتات المحادثة الذكية" : "AI chatbots" },
                    { job: isAr ? "الترجمة التقليدية" : "Traditional Translation", risk: "75%", reason: isAr ? "الترجمة الآلية المتقدمة" : "Advanced machine translation" },
                    { job: isAr ? "التصميم الجرافيكي البسيط" : "Basic Graphic Design", risk: "70%", reason: isAr ? "أدوات التصميم بالذكاء الاصطناعي" : "AI design tools" },
                    { job: isAr ? "البرمجة التقليدية (CRUD)" : "Traditional Programming (CRUD)", risk: "65%", reason: isAr ? "أدوات توليد الكود" : "Code generation tools" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-destructive/5 rounded-xl">
                      <span className="text-sm font-bold text-destructive w-12 shrink-0">{item.risk}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-sm">{item.job}</div>
                        <div className="text-xs text-muted-foreground truncate">{item.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <SourceBadge source="McKinsey 2024" url="https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier" isAr={isAr} />
                </div>
              </motion.div>

              {/* Growing */}
              <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="bg-card border border-primary/20 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold text-foreground">{isAr ? "وظائف في نمو" : "Growing Jobs"}</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { job: isAr ? "هندسة الذكاء الاصطناعي" : "AI/ML Engineering", growth: "+74%", salary: isAr ? "متوسط $150K+" : "Avg $150K+" },
                    { job: isAr ? "الأمن السيبراني" : "Cybersecurity", growth: "+35%", salary: isAr ? "متوسط $120K+" : "Avg $120K+" },
                    { job: isAr ? "هندسة البيانات" : "Data Engineering", growth: "+30%", salary: isAr ? "متوسط $130K+" : "Avg $130K+" },
                    { job: isAr ? "تصميم تجربة المستخدم AI" : "AI UX Design", growth: "+28%", salary: isAr ? "متوسط $110K+" : "Avg $110K+" },
                    { job: isAr ? "هندسة الروبوتات" : "Robotics Engineering", growth: "+25%", salary: isAr ? "متوسط $125K+" : "Avg $125K+" },
                    { job: isAr ? "أخلاقيات التقنية" : "Tech Ethics", growth: "+22%", salary: isAr ? "متوسط $100K+" : "Avg $100K+" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl">
                      <span className="text-sm font-bold text-primary w-12 shrink-0">{item.growth}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-sm">{item.job}</div>
                        <div className="text-xs text-muted-foreground truncate">{item.salary}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <SourceBadge source="U.S. Bureau of Labor Statistics" url="https://www.bls.gov/ooh/fastest-growing.htm" isAr={isAr} />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ====== WHO WE ARE — DEEP SECTION ====== */}
        <section className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                {isAr ? "من نحن؟ ولماذا نختلف جوهرياً؟" : "Who Are We? And Why Are We Fundamentally Different?"}
              </h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto">
                {isAr
                  ? "في عالم تتكاثر فيه منصات الاستشارات التعليمية، نقف نحن في موقع مختلف تماماً. لسنا وسيطاً بينك وبين الجامعات — نحن منظومة ذكاء اصطناعي متكاملة هدفها الوحيد أن تتخذ أفضل قرار ممكن لمستقبلك."
                  : "In a world where educational consulting platforms multiply, we stand in a fundamentally different position. We're not a middleman between you and universities — we're an integrated AI intelligence system whose sole purpose is to help you make the best possible decision for your future."}
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {[
                {
                  icon: Brain,
                  title: isAr ? "ذكاء اصطناعي حقيقي — لا شعارات تسويقية" : "Real AI — Not Marketing Slogans",
                  desc: isAr
                    ? "نظامنا يحلل أكثر من 50,000 برنامج أكاديمي عبر 100+ دولة في ثوانٍ. نستخدم نماذج تعلم آلي مخصصة (وليس ChatGPT فقط) لمطابقة ملفك الشخصي مع البرامج الأنسب لك بدقة تتجاوز 90%. كل هذا مبني على بيانات حقيقية لا ادعاءات."
                    : "Our system analyzes over 50,000 academic programs across 100+ countries in seconds. We use custom ML models (not just ChatGPT) to match your profile with the most suitable programs with over 90% accuracy. All built on real data, not claims.",
                },
                {
                  icon: BarChart3,
                  title: isAr ? "بيانات من مصادر موثوقة" : "Data from Trusted Sources",
                  desc: isAr
                    ? "نجمع البيانات من QS, THE, ARWU, Glassdoor, LinkedIn, وزارات التعليم، مكاتب الإحصاء الوطنية، وقواعد بيانات التأشيرات. كل رقم نعرضه قابل للتتبع حتى مصدره الأصلي — هذا ما نسميه 'الشفافية المبنية على الأدلة'."
                    : "We gather data from QS, THE, ARWU, Glassdoor, LinkedIn, education ministries, national statistics offices, and visa databases. Every number we display is traceable to its original source — this is what we call 'evidence-based transparency'.",
                },
                {
                  icon: Globe,
                  title: isAr ? "تغطية لا مثيل لها" : "Unmatched Coverage",
                  desc: isAr
                    ? "بينما يركز المنافسون على 5-10 دول، نغطي نحن أكثر من 100 دولة. من تركيا إلى أستراليا، من ألمانيا إلى ماليزيا. لأن الفرصة المثالية قد تكون في مكان لم تفكر فيه أبداً."
                    : "While competitors focus on 5-10 countries, we cover over 100. From Turkey to Australia, from Germany to Malaysia. Because your perfect opportunity might be somewhere you never considered.",
                },
                {
                  icon: Eye,
                  title: isAr ? "شفافية مطلقة — لا عمولات خفية" : "Absolute Transparency — No Hidden Commissions",
                  desc: isAr
                    ? "كثير من المنصات توجهك لجامعات تدفع لهم عمولات أعلى. نحن نعرض لك كل الخيارات مرتبة حسب ملاءمتها لك — وليس حسب العائد المادي. نؤمن أن ثقتك أغلى من أي عمولة."
                    : "Many platforms direct you to universities that pay them higher commissions. We show you all options ranked by their fit for YOU — not by financial return. We believe your trust is more valuable than any commission.",
                },
                {
                  icon: Users,
                  title: isAr ? "فريق متعدد الثقافات" : "Multicultural Team",
                  desc: isAr
                    ? "مستشارونا خريجون من جامعات في أكثر من 15 دولة. يتحدثون لغتك ويفهمون ثقافتك ويعرفون تحديات الطالب الدولي من تجربة شخصية — لأنهم عاشوها."
                    : "Our counselors are graduates from universities in 15+ countries. They speak your language, understand your culture, and know the challenges of being an international student firsthand — because they lived it.",
                },
                {
                  icon: Clock,
                  title: isAr ? "من أسابيع إلى دقائق" : "From Weeks to Minutes",
                  desc: isAr
                    ? "البحث التقليدي عن الجامعات يستغرق 3-6 أشهر. نظامنا يقلص ذلك إلى جلسة واحدة. نعالج ملايين نقاط البيانات لنقدم لك قائمة مختصرة مخصصة خلال دقائق — مدعومة بتحليل عميق لكل خيار."
                    : "Traditional university research takes 3-6 months. Our system reduces that to a single session. We process millions of data points to present you a personalized shortlist in minutes — backed by deep analysis of each option.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  {...fadeUp}
                  transition={{ delay: i * 0.08 }}
                  className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all hover:border-primary/30 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== ORX RANK DEEP DIVE ====== */}
        <section className="bg-muted/30 py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div {...fadeUp} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold mb-6"
                style={{ background: 'linear-gradient(135deg, hsl(45, 100%, 51%) 0%, hsl(36, 100%, 50%) 100%)', color: '#1a1a2e' }}>
                <Award className="w-4 h-4" />
                ORX RANK
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                {isAr ? "ORX RANK: لماذا أنشأنا نظام تقييم مختلف تماماً" : "ORX RANK: Why We Built a Completely Different Ranking System"}
              </h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto mb-4">
                {isAr
                  ? "التصنيفات التقليدية مثل QS و THE تعتمد بنسبة 30-50% على استبيانات السمعة — آراء أكاديميين قد لا يعرفون شيئاً عن البرنامج الذي تبحث عنه. ORX RANK يعتمد 100% على بيانات قابلة للقياس والتحقق."
                  : "Traditional rankings like QS and THE rely 30-50% on reputation surveys — opinions from academics who may know nothing about the program you're looking for. ORX RANK relies 100% on measurable, verifiable data."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <SourceBadge source="QS Methodology" url="https://www.topuniversities.com/qs-world-university-rankings/methodology" isAr={isAr} />
                <SourceBadge source="THE Methodology" url="https://www.timeshighereducation.com/world-university-rankings/world-university-rankings-methodology" isAr={isAr} />
              </div>
            </motion.div>

            {/* Comparison Table */}
            <motion.div {...fadeUp} className="bg-card border border-border rounded-2xl overflow-hidden mb-12">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="p-4 text-start font-bold text-foreground">{isAr ? "المعيار" : "Criteria"}</th>
                      <th className="p-4 text-center font-bold text-foreground">{isAr ? "التصنيفات التقليدية" : "Traditional Rankings"}</th>
                      <th className="p-4 text-center font-bold" style={{ color: 'hsl(45, 100%, 51%)' }}>ORX RANK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { criteria: isAr ? "مصدر البيانات" : "Data Source", trad: isAr ? "استبيانات سمعة (30-50%)" : "Reputation surveys (30-50%)", orx: isAr ? "بيانات موثقة 100%" : "100% documented data" },
                      { criteria: isAr ? "التركيز الزمني" : "Time Focus", trad: isAr ? "الإنجازات الماضية" : "Past achievements", orx: isAr ? "الجاهزية للمستقبل" : "Future readiness" },
                      { criteria: isAr ? "التخصيص" : "Personalization", trad: isAr ? "تصنيف واحد للجميع" : "One ranking for all", orx: isAr ? "مخصص لظروفك وأهدافك" : "Customized to your goals" },
                      { criteria: isAr ? "مستوى التحليل" : "Analysis Level", trad: isAr ? "على مستوى الجامعة فقط" : "University level only", orx: isAr ? "دولة + جامعة + برنامج" : "Country + University + Program" },
                      { criteria: isAr ? "الشفافية" : "Transparency", trad: isAr ? "منهجية عامة" : "General methodology", orx: isAr ? "كل درجة قابلة للتفسير" : "Every score explainable" },
                      { criteria: isAr ? "سوق العمل" : "Job Market", trad: isAr ? "غير مدرج" : "Not included", orx: isAr ? "نسب التوظيف الفعلية" : "Actual employment rates" },
                      { criteria: isAr ? "تكلفة المعيشة" : "Cost of Living", trad: isAr ? "غير مدرج" : "Not included", orx: isAr ? "تحليل شامل" : "Comprehensive analysis" },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-medium text-foreground">{row.criteria}</td>
                        <td className="p-4 text-center text-muted-foreground">{row.trad}</td>
                        <td className="p-4 text-center font-medium text-foreground">{row.orx}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Three Layers */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {[
                {
                  icon: Globe, pct: "20%",
                  title: isAr ? "سياق الدولة" : "Country Context",
                  desc: isAr
                    ? "نحلل 12 مؤشراً للدولة باستخدام بيانات البنك الدولي، OECD، ومؤشر السلام العالمي: جودة الحياة، الأمان، تكلفة المعيشة (Numbeo)، فرص العمل بعد التخرج (OECD data)، سياسات التأشيرات، الاعتراف الدولي بالشهادات، جودة الرعاية الصحية، والبنية التحتية للنقل."
                    : "We analyze 12 country indicators using World Bank, OECD, and Global Peace Index data: quality of life, safety, cost of living (Numbeo), post-graduation employment (OECD data), visa policies, international degree recognition, healthcare quality, and transportation infrastructure.",
                  sources: [
                    { name: "World Bank", url: "https://data.worldbank.org/" },
                    { name: "OECD", url: "https://www.oecd.org/education/" },
                  ],
                },
                {
                  icon: Building2, pct: "35%",
                  title: isAr ? "جاهزية الجامعة" : "University Readiness",
                  desc: isAr
                    ? "نقيّم 15 معياراً للجامعة: نسبة التوظيف الفعلية (ليس المُعلنة)، عدد الشراكات الصناعية النشطة، ميزانية البحث العلمي، نسبة الأساتذة لكل طالب، تبني التقنيات الحديثة (مختبرات AI، cloud labs)، نسبة الطلاب الدوليين، وشبكة الخريجين."
                    : "We evaluate 15 university criteria: actual employment rates (not claimed), active industry partnerships, research budget, professor-to-student ratio, modern technology adoption (AI labs, cloud labs), international student ratio, and alumni network.",
                  sources: [
                    { name: "QS Data", url: "https://www.topuniversities.com/" },
                    { name: "Glassdoor", url: "https://www.glassdoor.com/" },
                  ],
                },
                {
                  icon: GraduationCap, pct: "45%",
                  title: isAr ? "ملاءمة البرنامج" : "Program Fit",
                  desc: isAr
                    ? "الأهم والأعمق: نحلل المنهج الدراسي فعلياً (وليس فقط اسم التخصص). نقارن مخرجات التعلم مع أكثر 100 مهارة مطلوبة في سوق العمل (LinkedIn Skills Report). نقيّم فرص التدريب، المشاريع التطبيقية، ومعدل التحول إلى وظيفة خلال 6 أشهر من التخرج."
                    : "The most important and deepest: we actually analyze the curriculum (not just the major name). We compare learning outcomes with the top 100 in-demand skills (LinkedIn Skills Report). We evaluate internship opportunities, applied projects, and job conversion rates within 6 months of graduation.",
                  sources: [
                    { name: "LinkedIn Skills Report" , url: "https://economicgraph.linkedin.com/" },
                    { name: "Coursera Skills Index", url: "https://www.coursera.org/skills-reports/global" },
                  ],
                },
              ].map((layer, i) => (
                <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1" style={{ background: 'linear-gradient(90deg, hsl(45, 100%, 51%), hsl(36, 100%, 50%))' }} />
                  <div className="flex items-center justify-between mb-4">
                    <layer.icon className="w-8 h-8 text-primary" />
                    <span className="text-2xl font-bold" style={{ color: 'hsl(45, 100%, 51%)' }}>{layer.pct}</span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{layer.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{layer.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {layer.sources.map((s, j) => (
                      <SourceBadge key={j} source={s.name} url={s.url} isAr={isAr} />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== HOW WE HELP — ROADMAP ====== */}
        <section className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                {isAr ? "كيف نأخذك من الحيرة إلى القبول؟" : "How We Take You from Confusion to Acceptance"}
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                {isAr
                  ? "رحلتك معنا ليست مجرد اختيار جامعة — إنها بناء مسار مهني مقاوم للأتمتة ومُصمم للازدهار في عصر الذكاء الاصطناعي"
                  : "Your journey with us isn't just choosing a university — it's building a career path resistant to automation and designed to thrive in the AI era"}
              </p>
            </motion.div>

            <div className="space-y-6 max-w-4xl mx-auto">
              {[
                {
                  step: "01", icon: Target,
                  title: isAr ? "تشخيص شامل لملفك" : "Comprehensive Profile Diagnosis",
                  desc: isAr
                    ? "نبدأ بفهم عميق: مؤهلاتك الأكاديمية، مهاراتك اللغوية، ميزانيتك، أهدافك المهنية (قصيرة وطويلة المدى)، ومكان إقامتك. نحلل أكثر من 50 عاملاً لبناء 'البصمة الأكاديمية' الخاصة بك — وهي فريدة مثل بصمة إصبعك."
                    : "We start with deep understanding: your academic qualifications, language skills, budget, career goals (short and long-term), and location. We analyze 50+ factors to build your unique 'Academic Fingerprint' — as unique as your actual fingerprint.",
                },
                {
                  step: "02", icon: LineChart,
                  title: isAr ? "تحليل اتجاهات سوق العمل" : "Job Market Trend Analysis",
                  desc: isAr
                    ? "باستخدام بيانات من LinkedIn Economic Graph و Bureau of Labor Statistics الأمريكي و Eurostat، نراقب اتجاهات التوظيف في 50+ سوق عمل. نحدد المهارات الأسرع نمواً والتخصصات الأكثر مقاومة للأتمتة — ونطابقها مع اهتماماتك."
                    : "Using data from LinkedIn Economic Graph, U.S. Bureau of Labor Statistics, and Eurostat, we monitor employment trends in 50+ job markets. We identify fastest-growing skills and automation-resistant specializations — and match them with your interests.",
                },
                {
                  step: "03", icon: BarChart3,
                  title: isAr ? "مطابقة ذكية مع ORX RANK" : "Smart Matching with ORX RANK",
                  desc: isAr
                    ? "بعد تحديد مسارك المثالي، يقوم نظام ORX RANK بمسح آلاف البرامج ومطابقتها مع بصمتك الأكاديمية. النتيجة: قائمة مختصرة من 5-15 برنامجاً مرتبة حسب الملاءمة الشاملة — مع تقرير تفصيلي لكل خيار يوضح نقاط القوة والمخاطر."
                    : "After identifying your ideal path, ORX RANK scans thousands of programs and matches them with your Academic Fingerprint. Result: a shortlist of 5-15 programs ranked by comprehensive fit — with a detailed report for each option showing strengths and risks.",
                },
                {
                  step: "04", icon: Rocket,
                  title: isAr ? "دعم شامل من التقديم حتى الوصول" : "End-to-End Support from Application to Arrival",
                  desc: isAr
                    ? "نرافقك في كل خطوة: تجهيز ملفات القبول، كتابة رسائل الدافع، التحضير لاختبارات اللغة (IELTS, TOEFL, TestDaF)، تقديم التأشيرة، ترتيب السكن، وحتى التأقلم الثقافي. مستشارونا المتخصصون — الذين عاشوا تجربة الدراسة بالخارج شخصياً — يعملون معك حتى تحقق حلمك."
                    : "We accompany you at every step: preparing admission files, writing motivation letters, language test prep (IELTS, TOEFL, TestDaF), visa applications, housing arrangements, and even cultural adaptation. Our specialized counselors — who personally experienced studying abroad — work with you until you achieve your dream.",
                },
              ].map((item, i) => (
                <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}
                  className="flex gap-6 bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all group">
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <span className="text-3xl font-black text-primary/20 group-hover:text-primary/40 transition-colors">{item.step}</span>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== FUTURE SECTORS ====== */}
        <section className="bg-muted/30 py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                {isAr ? "القطاعات التي ستحكم العقد القادم" : "Sectors That Will Dominate the Next Decade"}
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-3">
                {isAr
                  ? "بناءً على تحليلات Gartner, McKinsey, و World Economic Forum — هذه القطاعات ستشهد أكبر نمو وأعلى رواتب بحلول 2030"
                  : "Based on analysis from Gartner, McKinsey, and World Economic Forum — these sectors will see the highest growth and salaries by 2030"}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <SourceBadge source="Gartner Top Trends 2025" url="https://www.gartner.com/en/articles/gartner-top-10-strategic-technology-trends-for-2025" isAr={isAr} />
                <SourceBadge source="WEF Future of Jobs" url="https://www.weforum.org/publications/the-future-of-jobs-report-2025/" isAr={isAr} />
              </div>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Brain, name: isAr ? "الذكاء الاصطناعي والتعلم الآلي" : "AI & Machine Learning", growth: "+74%", market: "$407B", marketLabel: isAr ? "حجم السوق 2027" : "Market 2027" },
                { icon: Shield, name: isAr ? "الأمن السيبراني" : "Cybersecurity", growth: "+35%", market: "$376B", marketLabel: isAr ? "حجم السوق 2029" : "Market 2029" },
                { icon: Lightbulb, name: isAr ? "الطاقة المتجددة والمناخ" : "Clean Energy & Climate", growth: "+30%", market: "$2.1T", marketLabel: isAr ? "استثمارات 2030" : "Investment 2030" },
                { icon: TrendingUp, name: isAr ? "التكنولوجيا المالية" : "FinTech", growth: "+28%", market: "$324B", marketLabel: isAr ? "حجم السوق 2028" : "Market 2028" },
                { icon: Cpu, name: isAr ? "الروبوتات والأتمتة الذكية" : "Robotics & Smart Automation", growth: "+25%", market: "$260B", marketLabel: isAr ? "حجم السوق 2030" : "Market 2030" },
                { icon: Heart, name: isAr ? "التكنولوجيا الحيوية والصحة الرقمية" : "Biotech & Digital Health", growth: "+22%", market: "$892B", marketLabel: isAr ? "حجم السوق 2028" : "Market 2028" },
                { icon: Layers, name: isAr ? "الحوسبة الكمومية" : "Quantum Computing", growth: "+30%", market: "$65B", marketLabel: isAr ? "حجم السوق 2030" : "Market 2030" },
                { icon: Star, name: isAr ? "تقنيات الفضاء" : "Space Technology", growth: "+18%", market: "$1.8T", marketLabel: isAr ? "اقتصاد الفضاء 2035" : "Space Economy 2035" },
              ].map((sector, i) => (
                <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all group text-center">
                  <sector.icon className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-foreground text-sm mb-2">{sector.name}</h4>
                  <div className="text-xs font-semibold text-primary mb-1">{isAr ? "نمو" : "Growth"} {sector.growth}</div>
                  <div className="text-[11px] text-muted-foreground">{sector.marketLabel}: {sector.market}</div>
                </motion.div>
              ))}
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              <SourceBadge source="Statista" url="https://www.statista.com/outlook/tmo/artificial-intelligence/worldwide" isAr={isAr} />
              <SourceBadge source="Morgan Stanley" url="https://www.morganstanley.com/ideas/investing-in-ai" isAr={isAr} />
              <SourceBadge source="IEA Clean Energy" url="https://www.iea.org/reports/world-energy-investment-2024" isAr={isAr} />
            </div>
          </div>
        </section>

        {/* ====== EDUCATION ROI ====== */}
        <section className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                {isAr ? "العائد على الاستثمار في التعليم: الأرقام تتحدث" : "Education ROI: The Numbers Speak"}
              </h2>
            </motion.div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {[
                {
                  stat: isAr ? "١.٢ مليون $" : "$1.2M",
                  label: isAr ? "فرق الدخل مدى الحياة بين حامل البكالوريوس ودبلوم الثانوية" : "Lifetime earning gap: Bachelor's vs. High School",
                  src: "Georgetown CEW",
                  url: "https://cew.georgetown.edu/cew-reports/the-college-payoff/",
                },
                {
                  stat: isAr ? "٤.٤٪" : "4.4%",
                  label: isAr ? "معدل بطالة حاملي البكالوريوس مقابل 7.7% للثانوية (عالمياً)" : "Unemployment: Bachelor's (4.4%) vs. High School (7.7%)",
                  src: "OECD Education at a Glance",
                  url: "https://www.oecd.org/education/education-at-a-glance/",
                },
                {
                  stat: isAr ? "+٦٦٪" : "+66%",
                  label: isAr ? "زيادة الراتب لخريجي برامج STEM مقارنة بالتخصصات الأخرى" : "STEM graduates earn 66% more than other majors",
                  src: "PayScale",
                  url: "https://www.payscale.com/college-salary-report",
                },
                {
                  stat: isAr ? "٧٤٪" : "74%",
                  label: isAr ? "من أصحاب العمل يفضلون خريجي جامعات ذات شراكات صناعية" : "Of employers prefer graduates from universities with industry ties",
                  src: "NACE Survey",
                  url: "https://www.naceweb.org/job-market/",
                },
              ].map((item, i) => (
                <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-6 text-center hover:shadow-md transition-all">
                  <div className="text-3xl font-black text-primary mb-2">{item.stat}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{item.label}</p>
                  <SourceBadge source={item.src} url={item.url} isAr={isAr} />
                </motion.div>
              ))}
            </div>

            {/* Final Quote */}
            <motion.div {...fadeUp}>
              <QuoteBlock
                quote={isAr
                  ? "التعليم هو السلاح الأقوى الذي يمكنك استخدامه لتغيير العالم. لكن في عصر الذكاء الاصطناعي، يجب أن يكون التعليم الصحيح — وليس أي تعليم."
                  : "Education is the most powerful weapon you can use to change the world. But in the AI era, it must be the right education — not just any education."}
                author={isAr ? "نيلسون مانديلا (مُعدّل)" : "Nelson Mandela (adapted)"}
                role={isAr ? "رمز الحرية والتعليم" : "Symbol of Freedom & Education"}
                isAr={isAr}
              />
            </motion.div>
          </div>
        </section>

        {/* ====== CTA ====== */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4">
            <motion.div {...fadeUp}
              className="relative rounded-3xl p-10 sm:p-16 text-center overflow-hidden"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)' }}>
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
              </div>
              <div className="relative z-10">
                <GraduationCap className="w-16 h-16 text-primary-foreground mx-auto mb-6 opacity-90" />
                <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
                  {isAr ? "مستقبلك يبدأ بقرار واحد" : "Your Future Starts with One Decision"}
                </h2>
                <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
                  {isAr
                    ? "لا تترك مستقبلك للصدفة في عالم يتغير بسرعة الضوء. دعنا نساعدك في اختيار الجامعة والتخصص الذي سيضعك في مقدمة قادة الغد. ابدأ رحلتك الآن مجاناً."
                    : "Don't leave your future to chance in a world changing at the speed of light. Let us help you choose the university and specialization that will put you at the forefront of tomorrow's leaders. Start your journey now for free."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link to="/universities">
                    <DSButton size="lg" className="bg-white text-primary hover:bg-white/90 font-bold px-8">
                      {isAr ? "ابحث عن جامعتك" : "Find Your University"}
                      <ArrowRight className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
                    </DSButton>
                  </Link>
                  <Link to="/orx-rank">
                    <DSButton variant="outline" size="lg" className="border-white/30 text-primary-foreground hover:bg-white/10 font-bold px-8">
                      {isAr ? "اكتشف ORX RANK" : "Discover ORX RANK"}
                    </DSButton>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
