/**
 * CountryHero - Clean, minimal hero for individual Country page
 * Same style as CountriesHero (gradient background, no image)
 * Now with full 12-language translation support
 */
import { motion } from "framer-motion";
import { Globe, MapPin, GraduationCap, Building2, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCountryName } from "@/hooks/useCountryName";
import type { CountryExtended } from "@/types/database-extensions";
import "@/styles/countries-hero.css";

interface CountryHeroProps {
  country: CountryExtended;
  slug: string;
  universitiesCount?: number;
  programsCount?: number;
}

// Helper function to get flag emoji from country code
function getFlagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function CountryHero({ country, slug, universitiesCount = 0, programsCount = 0 }: CountryHeroProps) {
  const { t, language } = useLanguage();
  const { getCountryName } = useCountryName();
  
  const countryName = getCountryName(country.country_code?.toLowerCase() || slug, country.name_ar);
  const flagEmoji = getFlagEmoji(country.country_code);

  return (
    <section className="countries-hero-minimal">
      {/* Gradient Background */}
      <div className="countries-hero-minimal__bg" />
      
      {/* Decorative shapes */}
      <div className="countries-hero-minimal__shapes">
        <div className="countries-hero-minimal__shape countries-hero-minimal__shape--1" />
        <div className="countries-hero-minimal__shape countries-hero-minimal__shape--2" />
      </div>

      {/* Content */}
      <div className="countries-hero-minimal__content">
        {/* Badge with Flag */}
        <motion.div 
          className="countries-hero-minimal__badge"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-lg">{flagEmoji}</span>
          <span>{t("hero.studyAbroad")}</span>
        </motion.div>

        {/* Title */}
        <motion.h1 
          className="countries-hero-minimal__title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t("country.studyIn")} {countryName}
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          className="countries-hero-minimal__subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {country.seo_description || t("hero.discoverOpportunities").replace("{country}", countryName)}
        </motion.p>

        {/* Inline Stats */}
        <motion.div 
          className="countries-hero-minimal__stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {universitiesCount > 0 && (
            <>
              <div className="countries-hero-minimal__stat">
                <Building2 className="w-4 h-4" />
                <span className="countries-hero-minimal__stat-value">{universitiesCount}</span>
                <span className="countries-hero-minimal__stat-label">{t("country.universities")}</span>
              </div>
              
              <span className="countries-hero-minimal__stat-divider">•</span>
            </>
          )}
          
          {programsCount > 0 && (
            <>
              <div className="countries-hero-minimal__stat">
                <BookOpen className="w-4 h-4" />
                <span className="countries-hero-minimal__stat-value">{programsCount.toLocaleString()}</span>
                <span className="countries-hero-minimal__stat-label">{t("country.programs")}</span>
              </div>
              
              <span className="countries-hero-minimal__stat-divider">•</span>
            </>
          )}
          
          {country.international_students && country.international_students > 0 && (
            <div className="countries-hero-minimal__stat">
              <GraduationCap className="w-4 h-4" />
              <span className="countries-hero-minimal__stat-value">{country.international_students.toLocaleString()}</span>
              <span className="countries-hero-minimal__stat-label">{t("country.internationalStudents")}</span>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
