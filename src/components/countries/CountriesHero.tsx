/**
 * CountriesHero - Clean, minimal hero section for Study Destinations page
 * Features:
 * - Elegant gradient background (no distracting images)
 * - Compact height (40vh max)
 * - Stats displayed inline
 * - Full i18n support with t() function
 */
import { motion } from "framer-motion";
import { Globe, MapPin, GraduationCap, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import "@/styles/countries-hero.css";

interface CountriesHeroProps {
  totalStats: {
    countries: number;
    universities: number;
    programs: number;
  };
}

export function CountriesHero({ totalStats }: CountriesHeroProps) {
  const { t } = useLanguage();

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
        {/* Badge */}
        <motion.div 
          className="countries-hero-minimal__badge"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Globe className="w-4 h-4" />
          <span>{t("countriesPage.hero.badge")}</span>
        </motion.div>

        {/* Title */}
        <motion.h1 
          className="countries-hero-minimal__title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t("countriesPage.hero.title")}
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          className="countries-hero-minimal__subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {t("countriesPage.hero.subtitle")}
        </motion.p>

        {/* Inline Stats */}
        <motion.div 
          className="countries-hero-minimal__stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="countries-hero-minimal__stat">
            <MapPin className="w-4 h-4" />
            <span className="countries-hero-minimal__stat-value">{totalStats.countries}</span>
            <span className="countries-hero-minimal__stat-label">{t("countriesPage.hero.stats.countries")}</span>
          </div>
          
          <span className="countries-hero-minimal__stat-divider">•</span>
          
          <div className="countries-hero-minimal__stat">
            <GraduationCap className="w-4 h-4" />
            <span className="countries-hero-minimal__stat-value">{totalStats.universities.toLocaleString()}</span>
            <span className="countries-hero-minimal__stat-label">{t("countriesPage.hero.stats.universities")}</span>
          </div>
          
          <span className="countries-hero-minimal__stat-divider">•</span>
          
          <div className="countries-hero-minimal__stat">
            <BookOpen className="w-4 h-4" />
            <span className="countries-hero-minimal__stat-value">{totalStats.programs.toLocaleString()}</span>
            <span className="countries-hero-minimal__stat-label">{t("countriesPage.hero.stats.programs")}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
