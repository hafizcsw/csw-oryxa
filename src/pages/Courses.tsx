import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Languages, MapPin, Calendar, Star } from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { useNavigate } from "react-router-dom";

const courses = [
  { titleAr: "دورة اللغة الإنجليزية العامة", titleEn: "General English Course", durationAr: "4 - 12 أسبوع", durationEn: "4 - 12 weeks", locationAr: "متعدد الدول", locationEn: "Multiple Countries" },
  { titleAr: "دورة الإنجليزية الأكاديمية", titleEn: "Academic English Course", durationAr: "8 - 24 أسبوع", durationEn: "8 - 24 weeks", locationAr: "بريطانيا، أمريكا، كندا", locationEn: "UK, USA, Canada" },
  { titleAr: "دورة التحضير للجامعة", titleEn: "University Foundation Course", durationAr: "12 - 36 أسبوع", durationEn: "12 - 36 weeks", locationAr: "بريطانيا، أستراليا", locationEn: "UK, Australia" },
  { titleAr: "دورة اللغة الإنجليزية للأعمال", titleEn: "Business English Course", durationAr: "4 - 12 أسبوع", durationEn: "4 - 12 weeks", locationAr: "متعدد الدول", locationEn: "Multiple Countries" },
];

export default function Courses() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {isAr ? "دورات اللغة" : "Language Courses"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isAr
              ? "اختر من بين مجموعة متنوعة من دورات اللغة الإنجليزية في أفضل المعاهد حول العالم"
              : "Choose from a variety of English language courses at top institutes worldwide"}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {courses.map((c, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Languages className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground mb-2">{isAr ? c.titleAr : c.titleEn}</h3>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{isAr ? c.durationAr : c.durationEn}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{isAr ? c.locationAr : c.locationEn}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <DSButton onClick={() => navigate("/contact")} size="lg">
            {isAr ? "استفسر عن الدورات" : "Inquire About Courses"}
          </DSButton>
        </div>
      </div>
    </Layout>
  );
}
