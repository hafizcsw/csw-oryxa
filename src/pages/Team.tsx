import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { User } from "lucide-react";

const teamMembers = [
  { nameAr: "فريق القبول الجامعي", nameEn: "Admissions Team", roleAr: "متخصصون في القبولات الجامعية الدولية", roleEn: "Specialists in international university admissions" },
  { nameAr: "فريق التأشيرات", nameEn: "Visa Team", roleAr: "خبراء في إجراءات التأشيرات والإقامة", roleEn: "Experts in visa and residence procedures" },
  { nameAr: "فريق دعم الطلاب", nameEn: "Student Support Team", roleAr: "مستشارون يرافقون الطالب في كل مرحلة", roleEn: "Counselors who accompany students at every stage" },
  { nameAr: "فريق التسويق والتواصل", nameEn: "Marketing & Outreach", roleAr: "نوصل صوتك لأفضل الجامعات العالمية", roleEn: "Connecting you with the best global universities" },
];

export default function Team() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {isAr ? "فريق العمل" : "Our Team"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isAr
              ? "فريق متخصص ومتعدد الخبرات يعمل على تحقيق أحلامك الأكاديمية"
              : "A specialized and diverse team working to achieve your academic dreams"}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {teamMembers.map((member, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 border border-border shadow-sm text-center hover:shadow-md transition-shadow">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-1">
                {isAr ? member.nameAr : member.nameEn}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAr ? member.roleAr : member.roleEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
