import { useNavigate } from "react-router-dom";
import { Instagram, MessageCircle, Mail, Phone, Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useStaffAuthority } from "@/hooks/useStaffAuthority";
import { useTeacherPermissions } from "@/lib/teacherPermissions";

export function Footer() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { isStaff, role } = useStaffAuthority();
  const permissions = useTeacherPermissions(role);
  const isTeacher = isStaff && role === 'teacher';
  const isSuperAdmin = isStaff && role === 'super_admin';
  const pathname = window.location.pathname;
  const hideStudentNav = isTeacher && pathname.startsWith('/staff') && !isSuperAdmin;

  const aboutLinks = [
    { label: t("footer.whoWeAre"), href: "/about" },
    { label: t("footer.aboutOryxa"), href: "/about-oryxa" },
    { label: t("footer.team"), href: "/team" },
    { label: t("footer.partners"), href: "/partners" },
    { label: t("footer.contactUs"), href: "/contact" },
    { label: t("nav.community"), href: "/community" },
    { label: t("nav.news"), href: "/blog" },
    { label: t("nav.events"), href: "/events" },
    { label: t("nav.findUs"), href: "/where-we-are" },
  ];

  const institutionLinks = [
    { label: t("footer.forInstitutions"), href: "/for-institutions" },
    { label: t("footer.exploreMap"), href: "/explore-map" },
  ];

  const servicesLinks = [
    { label: t("footer.pricingByRegion"), href: "/paid-services" },
    { label: t("footer.housing"), href: "/services/accommodation" },
    { label: t("footer.visa"), href: "/services/visa" },
    { label: t("footer.airport"), href: "/services/airport" },
    { label: t("footer.bank"), href: "/services/bank" },
  ];

  const studyLinks = [
    { label: t("footer.destinations"), href: "/#destinations" },
    { label: t("footer.findUni"), href: "/universities?tab=universities" },
    { label: t("footer.programs"), href: "/universities?tab=programs" },
    { label: t("footer.scholarships"), href: "/universities?tab=scholarships" },
  ];

  const institutionsLink = { label: t("footer.forInstitutions"), href: "/for-institutions" };

  const resourcesLinks = [
    { label: t("orx.brandName"), href: "/orx-rank" },
    { label: t("footer.languages"), href: "/languages" },
    { label: t("footer.courses"), href: "/courses" },
    { label: t("footer.blog"), href: "/blog" },
    { label: t("footer.faq"), href: "/faq" },
  ];

  const careersLinks = [
    { label: t("footer.openPositions"), href: "/careers" },
    { label: t("footer.workWithUs"), href: "/careers#why-us" },
    { label: t("footer.internships"), href: "/careers#internships" },
  ];

  const handleLinkClick = (href: string, external?: boolean) => {
    if (external) {
      window.open(href, "_blank");
    } else {
      navigate(href);
    }
  };

  return (
    <footer className="bg-muted/30 border-t-2 border-border py-16 mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        {/* Footer Grid - hidden only on staff routes for teachers */}
        {!hideStudentNav && (
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-10 mb-12`} dir={isRtl ? "rtl" : "ltr"}>
          {/* About Column */}
          <div>
            <h3 className="text-foreground font-bold text-lg mb-5">{t("footer.about")}</h3>
            <ul className="space-y-3">
              {aboutLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => handleLinkClick(link.href)}
                    className="text-foreground font-bold text-[14px] hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* For Institutions Column */}
          <div>
            <h3 className="text-foreground font-bold text-lg mb-5">{t("footer.institutionsTitle")}</h3>
            <ul className="space-y-3">
              {institutionLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => handleLinkClick(link.href)}
                    className="text-foreground font-bold text-[14px] hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Services Column */}
          <div>
            <h3 className="text-foreground font-bold text-lg mb-5">{t("footer.services")}</h3>
            <ul className="space-y-3">
              {servicesLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => handleLinkClick(link.href)}
                    className="text-foreground font-bold text-[14px] hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Study Column */}
          <div>
            <h3 className="text-foreground font-bold text-lg mb-5">{t("footer.study")}</h3>
            <ul className="space-y-3">
              {studyLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => handleLinkClick(link.href)}
                    className="text-foreground font-bold text-[14px] hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="text-foreground font-bold text-lg mb-5">{t("footer.resources")}</h3>
            <ul className="space-y-3">
              {resourcesLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => handleLinkClick(link.href)}
                    className="text-foreground font-bold text-[14px] hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Careers Column */}
          <div>
            <h3 className="text-foreground font-bold text-lg mb-5">{t("footer.careers")}</h3>
            <ul className="space-y-3">
              {careersLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => handleLinkClick(link.href)}
                    className="text-foreground font-bold text-[14px] hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        )}

        {/* Social & Contact Row */}
        <div className="border-t border-border pt-8 mb-8">
          <div className="flex flex-wrap justify-center gap-6">
            <a 
              href="https://wa.me/79013561060" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm">{t("footer.whatsapp")}</span>
            </a>
            <a 
              href="https://www.instagram.com/csworld.arabic/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Instagram className="w-5 h-5" />
              <span className="text-sm">{t("footer.instagram")}</span>
            </a>
            <a 
              href="mailto:info@connectstudyworld.com"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="w-5 h-5" />
              <span className="text-sm">{t("footer.email")}</span>
            </a>
            <a 
              href="tel:+79013561060"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Phone className="w-5 h-5" />
              <span className="text-sm">{t("footer.call")}</span>
            </a>
          </div>
        </div>

        {/* Copyright & Legal */}
        <div className="text-center space-y-2">
          <div className="flex justify-center gap-4">
            <button
              onClick={() => handleLinkClick(isTeacher ? "/privacy-policy/teacher" : "/privacy-policy")}
              className="text-muted-foreground hover:text-primary transition-colors text-xs underline"
            >
              {t("legal.privacyPolicy")}
            </button>
          </div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Connect Study World. {t("footer.copyright")}.
          </p>
        </div>
      </div>
    </footer>
  );
}
