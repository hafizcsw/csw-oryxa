import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Shield, MapPin, Percent, Globe, HeadphonesIcon } from "lucide-react";

const features = [
  {
    icon: Zap,
    titleAr: "تحويل فوري",
    titleEn: "Instant Transfer",
    descriptionAr: "تصل حوالتك خلال 24-48 ساعة فقط",
    descriptionEn: "Your transfer arrives in just 24-48 hours",
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: Percent,
    titleAr: "بدون رسوم خفية",
    titleEn: "No Hidden Fees",
    descriptionAr: "رسوم شفافة ومعلنة مسبقاً",
    descriptionEn: "Transparent and upfront fees",
    color: "from-green-500 to-emerald-500",
    bgColor: "bg-green-500/10",
  },
  {
    icon: MapPin,
    titleAr: "تتبع لحظي",
    titleEn: "Real-time Tracking",
    descriptionAr: "تابع حوالتك من الإرسال للوصول",
    descriptionEn: "Track your transfer from send to arrival",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Shield,
    titleAr: "آمن ومشفر",
    titleEn: "Secure & Encrypted",
    descriptionAr: "تشفير بنكي متقدم لحماية أموالك",
    descriptionEn: "Bank-grade encryption protects your money",
    color: "from-purple-500 to-indigo-500",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Globe,
    titleAr: "أسعار صرف حقيقية",
    titleEn: "Real Exchange Rates",
    descriptionAr: "سعر السوق الحقيقي بدون هامش ربح",
    descriptionEn: "Real market rates with no markup",
    color: "from-pink-500 to-rose-500",
    bgColor: "bg-pink-500/10",
  },
  {
    icon: HeadphonesIcon,
    titleAr: "دعم على مدار الساعة",
    titleEn: "24/7 Support",
    descriptionAr: "فريق دعم متاح دائماً لمساعدتك",
    descriptionEn: "Support team always available to help",
    color: "from-teal-500 to-cyan-500",
    bgColor: "bg-teal-500/10",
  },
];

export function TransferFeatureCards() {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            {isRTL ? "لماذا تختار خدمة التحويل لدينا؟" : "Why Choose Our Transfer Service?"}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {isRTL 
              ? "نقدم لك تجربة تحويل أموال سلسة وآمنة مع أفضل أسعار الصرف"
              : "We offer you a seamless and secure money transfer experience with the best exchange rates"
            }
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index} 
                className="border-border/50 bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className={`w-14 h-14 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <div className={`bg-gradient-to-br ${feature.color} rounded-lg p-2`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h3 className="font-bold text-foreground mb-2 text-lg">
                    {isRTL ? feature.titleAr : feature.titleEn}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {isRTL ? feature.descriptionAr : feature.descriptionEn}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
