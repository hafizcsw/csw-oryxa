import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";

const supportedCurrencies = [
  { code: "SAR", flag: "🇸🇦", nameAr: "السعودية", nameEn: "Saudi Arabia" },
  { code: "AED", flag: "🇦🇪", nameAr: "الإمارات", nameEn: "UAE" },
  { code: "KWD", flag: "🇰🇼", nameAr: "الكويت", nameEn: "Kuwait" },
  { code: "QAR", flag: "🇶🇦", nameAr: "قطر", nameEn: "Qatar" },
  { code: "BHD", flag: "🇧🇭", nameAr: "البحرين", nameEn: "Bahrain" },
  { code: "OMR", flag: "🇴🇲", nameAr: "عُمان", nameEn: "Oman" },
  { code: "USD", flag: "🇺🇸", nameAr: "أمريكا", nameEn: "USA" },
  { code: "EUR", flag: "🇪🇺", nameAr: "أوروبا", nameEn: "Europe" },
  { code: "GBP", flag: "🇬🇧", nameAr: "بريطانيا", nameEn: "UK" },
  { code: "RUB", flag: "🇷🇺", nameAr: "روسيا", nameEn: "Russia" },
  { code: "TRY", flag: "🇹🇷", nameAr: "تركيا", nameEn: "Turkey" },
  { code: "EGP", flag: "🇪🇬", nameAr: "مصر", nameEn: "Egypt" },
  { code: "JOD", flag: "🇯🇴", nameAr: "الأردن", nameEn: "Jordan" },
  { code: "MAD", flag: "🇲🇦", nameAr: "المغرب", nameEn: "Morocco" },
  { code: "CNY", flag: "🇨🇳", nameAr: "الصين", nameEn: "China" },
  { code: "INR", flag: "🇮🇳", nameAr: "الهند", nameEn: "India" },
];

export function SupportedCurrencies() {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            {isRTL ? "العملات والدول المدعومة" : "Supported Currencies & Countries"}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {isRTL 
              ? "حوّل أموالك إلى أكثر من 15 عملة حول العالم"
              : "Transfer your money to over 15 currencies worldwide"
            }
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 max-w-6xl mx-auto">
          {supportedCurrencies.map((currency, index) => (
            <Card 
              key={currency.code}
              className="p-4 text-center border-border/50 bg-card hover:bg-muted/50 hover:border-primary/30 transition-all duration-300 hover:scale-105 cursor-default group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                {currency.flag}
              </div>
              <p className="font-bold text-foreground text-sm">{currency.code}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? currency.nameAr : currency.nameEn}
              </p>
            </Card>
          ))}
        </div>

        {/* More Coming Badge */}
        <div className="text-center mt-8">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            {isRTL ? "المزيد من العملات قريباً..." : "More currencies coming soon..."}
          </span>
        </div>
      </div>
    </section>
  );
}
