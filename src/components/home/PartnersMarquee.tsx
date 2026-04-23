import { Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Sample university logos/names - in production these would come from database
const partners = [
  { name: "Moscow State University", logo: "/logos/msu.png" },
  { name: "Saint Petersburg University", logo: "/logos/spbu.png" },
  { name: "Lomonosov University", logo: "/logos/lomonosov.png" },
  { name: "MGIMO University", logo: "/logos/mgimo.png" },
  { name: "Kazan Federal University", logo: "/logos/kazan.png" },
  { name: "Novosibirsk State University", logo: "/logos/nsu.png" },
  { name: "Tomsk State University", logo: "/logos/tomsk.png" },
  { name: "Ural Federal University", logo: "/logos/ural.png" },
  { name: "RUDN University", logo: "/logos/rudn.png" },
  { name: "Higher School of Economics", logo: "/logos/hse.png" },
  { name: "Bauman Moscow State", logo: "/logos/bauman.png" },
  { name: "Sechenov University", logo: "/logos/sechenov.png" }
];

const PartnerLogo = ({ name, logo }: { name: string; logo: string }) => (
  <div className="flex-shrink-0 px-8">
    <div className="h-16 w-40 flex items-center justify-center rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-300 group">
      {/* Fallback to text if no logo */}
      <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
        <Building2 className="w-5 h-5" />
        <span className="text-xs font-medium truncate max-w-[100px]">{name}</span>
      </div>
    </div>
  </div>
);

export const PartnersMarquee = () => {
  const { t } = useLanguage();
  
  return (
    <section className="py-16 bg-transparent overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-10">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-primary">
            {t("home.partners.badge")}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {t("home.partners.title")}
          </h2>
        </div>
      </div>
      
      {/* Marquee container */}
      <div className="relative">
        {/* Gradient overlays */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-muted/30 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-muted/30 to-transparent z-10 pointer-events-none" />
        
        
        {/* Second row - right to left */}
        <div className="flex">
          <div className="flex animate-marquee-reverse">
            {[...partners].reverse().map((partner, index) => (
              <PartnerLogo key={`row2-${index}`} {...partner} />
            ))}
          </div>
          <div className="flex animate-marquee-reverse" aria-hidden>
            {[...partners].reverse().map((partner, index) => (
              <PartnerLogo key={`row2-dup-${index}`} {...partner} />
            ))}
          </div>
        </div>
      </div>
      
      {/* Stats below marquee */}
      <div className="max-w-7xl mx-auto px-6 mt-12">
        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">150+</div>
            <div className="text-sm text-muted-foreground">
              {t("home.partners.stats.partnerUniversities")}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">25+</div>
            <div className="text-sm text-muted-foreground">
              {t("home.partners.stats.countries")}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">500+</div>
            <div className="text-sm text-muted-foreground">
              {t("home.partners.stats.studyPrograms")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
