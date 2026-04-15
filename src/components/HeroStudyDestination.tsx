import React from "react";
import { Building2, Users, Award, GraduationCap, ChevronDown, Globe, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import "@/styles/country-hero.css";

type HeroProps = {
  country: string;
  fromCountry: string;
  onPrimary?: () => void;
};

export default function HeroStudyDestination({
  country,
  fromCountry,
  onPrimary
}: HeroProps) {
  const { t } = useLanguage();

  return (
    <section className="hero-modern">
      {/* Background Layer */}
      <div className="hero-bg-layer">
        <div className="hero-bg-gradient" />
        <div className="hero-overlay" />
        
        {/* Floating Animated Shapes */}
        <div className="hero-floating-shapes">
          <div className="floating-shape floating-shape-1" />
          <div className="floating-shape floating-shape-2" />
          <div className="floating-shape floating-shape-3" />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="hero-breadcrumb">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            <li className="hover:text-white cursor-pointer transition-colors">Connect Study World</li>
            <span>/</span>
            <li className="hover:text-white cursor-pointer transition-colors">{t("hero.studyAbroad")}</li>
            <span>/</span>
            <li>{t("country.studyIn")} {country} {t("country.from")} {fromCountry}</li>
          </ol>
        </nav>
      </div>

      {/* Content Layer */}
      <div className="hero-content">
        {/* Main Title with Gradient */}
        <h1 className="hero-title-gradient">
          {t("country.studyIn")} {country}
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle">
          {t("hero.discoverWorldClass")}
        </p>

        {/* Stats Grid with Glass Cards */}
        <div className="hero-stats-grid">
          <div className="hero-stat-card">
            <Building2 className="hero-stat-icon" />
            <div className="hero-stat-value">150+</div>
            <div className="hero-stat-label">{t("hero.accreditedUniversities")}</div>
          </div>

          <div className="hero-stat-card">
            <Users className="hero-stat-icon" />
            <div className="hero-stat-value">50,000+</div>
            <div className="hero-stat-label">{t("hero.internationalStudents")}</div>
          </div>

          <div className="hero-stat-card">
            <Award className="hero-stat-icon" />
            <div className="hero-stat-value">200+</div>
            <div className="hero-stat-label">{t("hero.scholarships")}</div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="hero-cta-group">
          <button onClick={onPrimary} className="hero-btn-primary">
            <GraduationCap className="w-5 h-5" />
            {t("hero.startApplication")}
          </button>
          
          <button 
            onClick={() => {
              const universitiesSection = document.getElementById('universities');
              universitiesSection?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="hero-btn-secondary"
          >
            <Globe className="w-5 h-5" />
            {t("hero.browseUniversities")}
          </button>
        </div>

        {/* Feature Badges */}
        <div className="hero-badges">
          <div className="hero-badge">
            <CheckCircle2 className="w-4 h-4" />
            {t("hero.easyVisa")}
          </div>
          <div className="hero-badge">
            <CheckCircle2 className="w-4 h-4" />
            {t("hero.postGradWork")}
          </div>
          <div className="hero-badge">
            <CheckCircle2 className="w-4 h-4" />
            {t("hero.affordableLiving")}
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="hero-scroll-indicator">
        <ChevronDown className="hero-scroll-icon" />
      </div>
    </section>
  );
}
