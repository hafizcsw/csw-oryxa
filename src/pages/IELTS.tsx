import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookOpen, Target, Clock, CheckCircle } from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { useNavigate } from "react-router-dom";

export default function IELTS() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();

  const features = [
    { icon: BookOpen, titleAr: "مواد تحضيرية شاملة", titleEn: "Comprehensive Materials", descAr: "دروس ومواد تغطي جميع أقسام الاختبار", descEn: "Lessons and materials covering all test sections" },
    { icon: Target, titleAr: "اختبارات تجريبية", titleEn: "Practice Tests", descAr: "اختبارات محاكاة لتقييم مستواك الحقيقي", descEn: "Mock tests to evaluate your real level" },
    { icon: Clock, titleAr: "جداول مرنة", titleEn: "Flexible Schedules", descAr: "دورات بأوقات تناسب جدولك", descEn: "Courses at times that suit your schedule" },
    { icon: CheckCircle, titleAr: "نتائج مضمونة", titleEn: "Guaranteed Results", descAr: "نسبة نجاح عالية بين طلابنا", descEn: "High success rate among our students" },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
            {isAr ? "تحضير IELTS" : "IELTS Preparation"}
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {isAr ? "حقق الدرجة المطلوبة في اختبار IELTS" : "Achieve Your Target IELTS Score"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isAr
              ? "نقدم برامج تحضيرية متخصصة لاختبار IELTS مع مدربين معتمدين ومواد تعليمية محدثة"
              : "We offer specialized IELTS preparation programs with certified trainers and updated materials"}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((f, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 border border-border shadow-sm text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <f.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">
                {isAr ? f.titleAr : f.titleEn}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAr ? f.descAr : f.descEn}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <DSButton onClick={() => navigate("/contact")} size="lg">
            {isAr ? "تواصل معنا للتسجيل" : "Contact Us to Register"}
          </DSButton>
        </div>
      </div>
    </Layout>
  );
}
