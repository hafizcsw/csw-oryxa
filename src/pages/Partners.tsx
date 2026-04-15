import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Handshake, GraduationCap, Building2 } from "lucide-react";

export default function Partners() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const partnerTypes = [
    { icon: GraduationCap, titleAr: "جامعات شريكة", titleEn: "Partner Universities", descAr: "نتعاون مع مئات الجامعات المعتمدة حول العالم لتوفير أفضل الفرص التعليمية لطلابنا.", descEn: "We collaborate with hundreds of accredited universities worldwide to provide the best educational opportunities." },
    { icon: Building2, titleAr: "مؤسسات تعليمية", titleEn: "Educational Institutions", descAr: "شراكات مع معاهد لغة ومراكز تدريب معتمدة في مختلف الدول.", descEn: "Partnerships with accredited language institutes and training centers across various countries." },
    { icon: Handshake, titleAr: "شركاء الخدمات", titleEn: "Service Partners", descAr: "نعمل مع أفضل مزودي خدمات السكن والتأمين والنقل لضمان راحة الطلاب.", descEn: "We work with top housing, insurance, and transport providers to ensure student comfort." },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {isAr ? "شركاؤنا" : "Our Partners"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isAr
              ? "شبكة واسعة من الشراكات مع جامعات ومؤسسات تعليمية رائدة حول العالم"
              : "A wide network of partnerships with leading universities and educational institutions worldwide"}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {partnerTypes.map((p, i) => (
            <div key={i} className="bg-card rounded-2xl p-8 border border-border shadow-sm text-center">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <p.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">
                {isAr ? p.titleAr : p.titleEn}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {isAr ? p.descAr : p.descEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
