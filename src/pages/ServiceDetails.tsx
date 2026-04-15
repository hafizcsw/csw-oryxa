import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { servicesContent, ServiceContent } from "@/data/servicesContent";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ServicesNavBar } from "@/components/services/ServicesNavBar";
import { 
  MoneyTransferCalculator, 
  TransferFeatureCards, 
  SupportedCurrencies, 
  NotifyMeForm 
} from "@/components/services/transfer";
import { 
  Home, Shield, Clock, MapPin, Wallet, Car, CreditCard, Zap, Smartphone,
  GraduationCap, Award, Monitor, Users, Heart, Globe, FileText, Headphones,
  Wifi, Phone, FileCheck, CheckCircle, Banknote, Percent, Lock, ArrowLeft, 
  ArrowRight, MessageCircle, ChevronRight, TrendingUp, Eye
} from "lucide-react";
import { Helmet } from "react-helmet";

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  Shield, Clock, MapPin, Wallet, Car, CreditCard, Zap, Smartphone,
  GraduationCap, Award, Monitor, Users, Heart, Globe, FileText, Headphones,
  Wifi, Phone, FileCheck, CheckCircle, Banknote, Percent, Lock, Home, TrendingUp, Eye
};

interface ServiceFromDB {
  id: string;
  name: string;
  description: string | null;
  icon_key: string | null;
  is_active: boolean;
}

export default function ServiceDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const [serviceFromDB, setServiceFromDB] = useState<ServiceFromDB | null>(null);
  const [loading, setLoading] = useState(true);

  // Get static content
  const content: ServiceContent | undefined = slug ? servicesContent[slug] : undefined;

  useEffect(() => {
    async function fetchService() {
      if (!slug) return;
      
      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("slug", slug)
        .single();
      
      setServiceFromDB(data);
      setLoading(false);
    }
    fetchService();
  }, [slug]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!content) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? "الخدمة غير موجودة" : "Service Not Found"}
          </h1>
          <Link to="/">
            <Button>
              {isRTL ? "العودة للرئيسية" : "Back to Home"}
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const isTransferService = slug === "transfer_soon";
  const isTranslationService = slug === "translation_russia";

  // Special layout for Transfer Service - Premium dark design
  if (isTransferService) {
    const supportedCountries = [
      { code: "RU", flag: "🇷🇺", nameAr: "روسيا", nameEn: "Russia" },
      { code: "TR", flag: "🇹🇷", nameAr: "تركيا", nameEn: "Turkey" },
      { code: "EG", flag: "🇪🇬", nameAr: "مصر", nameEn: "Egypt" },
      { code: "AE", flag: "🇦🇪", nameAr: "الإمارات", nameEn: "UAE" },
      { code: "US", flag: "🇺🇸", nameAr: "أمريكا", nameEn: "USA" },
      { code: "GB", flag: "🇬🇧", nameAr: "بريطانيا", nameEn: "UK" },
    ];

    return (
      <Layout>
        <div className="min-h-screen bg-background dark:bg-slate-950">
          <Helmet>
            <title>{isRTL ? "تحويل الأموال - قريباً" : "Money Transfer - Coming Soon"}</title>
            <meta name="description" content={isRTL ? "خدمة تحويل الأموال الدولية قريباً" : "International money transfer service coming soon"} />
          </Helmet>

          {/* Services Navigation Bar */}
          <ServicesNavBar />

          {/* Hero Section - Premium dark design */}
          <section className="relative min-h-screen pt-24 pb-16 overflow-hidden">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-primary/10 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950" />
            
            {/* Decorative Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* Glowing orbs */}
              <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 dark:bg-violet-500/20 rounded-full blur-[100px] animate-pulse" />
              <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 dark:bg-indigo-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 dark:bg-purple-500/10 rounded-full blur-[150px]" />
              
              {/* Grid pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>

            <div className="container mx-auto px-4 relative z-10">
              {/* Back Link */}
              <Link 
                to="/" 
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
              >
                {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                {isRTL ? "العودة للرئيسية" : "Back to Home"}
              </Link>

              {/* Header Text */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-primary/10 dark:bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-primary/20 dark:border-white/10">
                  <span className="w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                    {isRTL ? "قريباً" : "Coming Soon"}
                  </span>
                </div>
                
                <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-foreground via-foreground to-primary/80 dark:from-white dark:via-white dark:to-violet-200 bg-clip-text text-transparent">
                  {isRTL ? "أسرع طريقة لإرسال الأموال" : "The fastest way to send money"}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                  {isRTL 
                    ? "تحويلات فورية بأفضل الأسعار وبدون رسوم خفية" 
                    : "Instant transfers with the best rates and no hidden fees"}
                </p>
              </div>

              {/* Calculator */}
              <div className="max-w-md mx-auto mb-16">
                <MoneyTransferCalculator />
              </div>

              {/* Supported Countries */}
              <div className="max-w-3xl mx-auto">
                <p className="text-center text-muted-foreground text-sm mb-4">
                  {isRTL ? "الدول المدعومة" : "Supported Countries"}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {supportedCountries.map((country) => (
                    <div 
                      key={country.code}
                      className="group flex items-center gap-2 bg-card/50 dark:bg-white/5 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-border dark:border-white/10 hover:border-primary/50 dark:hover:border-violet-500/50 hover:bg-card dark:hover:bg-white/10 transition-all duration-300 cursor-default"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform">{country.flag}</span>
                      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {isRTL ? country.nameAr : country.nameEn}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>{isRTL ? content.heroTitleAr : content.heroTitleEn} | CSW</title>
        <meta name="description" content={isRTL ? content.heroDescriptionAr : content.heroDescriptionEn} />
      </Helmet>

      {/* Services Navigation Bar */}
      <ServicesNavBar />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            {/* Back Link */}
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
            >
              {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              {isRTL ? "العودة للرئيسية" : "Back to Home"}
            </Link>

            {/* Service Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              {serviceFromDB?.icon_key && iconMap[serviceFromDB.icon_key] ? (
                (() => {
                  const IconComponent = iconMap[serviceFromDB.icon_key];
                  return <IconComponent className="w-10 h-10 text-primary-foreground" />;
                })()
              ) : (
                <Home className="w-10 h-10 text-primary-foreground" />
              )}
            </div>

            {/* Title & Description */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {isRTL ? content.heroTitleAr : content.heroTitleEn}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {isRTL ? content.heroDescriptionAr : content.heroDescriptionEn}
            </p>

            {/* Coming Soon Badge */}
            {content.comingSoon && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{isRTL ? "قريباً" : "Coming Soon"}</span>
              </div>
            )}
            
            {/* Translation Service CTA Button */}
            {isTranslationService && !content.comingSoon && (
              <div className="mt-8">
                <Link to="/app/translation/new">
                  <Button size="lg" className="gap-2 text-lg px-8 py-6 shadow-xl">
                    <FileText className="w-5 h-5" />
                    {isRTL ? "ابدأ طلب الترجمة الآن" : "Start Translation Order Now"}
                    <ArrowIcon className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      {content.features.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
              {isRTL ? "لماذا تختارنا؟" : "Why Choose Us?"}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {content.features.map((feature, index) => {
                const IconComponent = iconMap[feature.icon] || Shield;
                return (
                  <Card key={index} className="border-border/50 bg-card hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                        <IconComponent className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">
                        {isRTL ? feature.titleAr : feature.titleEn}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? feature.descriptionAr : feature.descriptionEn}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* How It Works Section */}
      {content.steps.length > 0 && (
        <section className="py-16 bg-muted/20">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-16">
              {isRTL ? "كيف تعمل الخدمة؟" : "How It Works"}
            </h2>

            <div className="max-w-5xl mx-auto">
              {/* Desktop: Horizontal Timeline */}
              <div className="hidden md:block relative">
                {/* Timeline Line - positioned at circle center */}
                <div className="absolute top-8 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/40 rounded-full" />
                
                <div className="flex justify-between relative">
                  {content.steps.map((step, index) => (
                    <div 
                      key={index} 
                      className="flex flex-col items-center text-center flex-1 px-3 group animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Step Circle */}
                      <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-primary-foreground text-xl font-bold shadow-xl shadow-primary/30 mb-6 group-hover:scale-110 transition-transform duration-300">
                        {step.number}
                      </div>
                      
                      <h3 className="font-bold text-foreground mb-2 text-base">
                        {isRTL ? step.titleAr : step.titleEn}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-[160px] leading-relaxed">
                        {isRTL ? step.descriptionAr : step.descriptionEn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile: Vertical Timeline */}
              <div className="md:hidden relative">
                {/* Vertical Line */}
                <div className={`absolute top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/70 to-primary/40 rounded-full ${isRTL ? 'right-8' : 'left-8'}`} />
                
                <div className="space-y-8">
                  {content.steps.map((step, index) => (
                    <div 
                      key={index} 
                      className={`flex items-start gap-6 animate-fade-in ${isRTL ? 'flex-row-reverse' : ''}`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Step Circle */}
                      <div className="relative z-10 w-16 h-16 flex-shrink-0 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-primary-foreground text-xl font-bold shadow-xl shadow-primary/30">
                        {step.number}
                      </div>
                      
                      <div className={`pt-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <h3 className="font-bold text-foreground mb-1 text-base">
                          {isRTL ? step.titleAr : step.titleEn}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {isRTL ? step.descriptionAr : step.descriptionEn}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      {!content.comingSoon && (
        <section className="py-16 bg-gradient-to-br from-primary to-primary/90">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-4">
                {isRTL ? "جاهز للبدء؟" : "Ready to Get Started?"}
              </h2>
              <p className="text-primary-foreground/80 mb-8">
                {isRTL 
                  ? "تواصل معنا الآن وسنساعدك في كل خطوة"
                  : "Contact us now and we'll help you every step of the way"
                }
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {/* Special CTA for Translation Service */}
                {isTranslationService ? (
                  <Link to="/app/translation/new">
                    <Button size="lg" variant="secondary" className="gap-2 min-w-[180px]">
                      <FileText className="w-4 h-4" />
                      {isRTL ? "ابدأ طلب الترجمة" : "Start Translation Order"}
                    </Button>
                  </Link>
                ) : (
                  <Link to="/apply">
                    <Button size="lg" variant="secondary" className="gap-2 min-w-[180px]">
                      <ArrowIcon className="w-4 h-4" />
                      {isRTL ? content.ctaTextAr : content.ctaTextEn}
                    </Button>
                  </Link>
                )}
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="gap-2 min-w-[180px] bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                    <MessageCircle className="w-4 h-4" />
                    {isRTL ? "تواصل معنا" : "Contact Us"}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {content.faqs.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
              {isRTL ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
            </h2>

            <div className="max-w-2xl mx-auto">
              <Accordion type="single" collapsible className="space-y-4">
                {content.faqs.map((faq, index) => (
                  <AccordionItem 
                    key={index} 
                    value={`faq-${index}`}
                    className="bg-card border border-border/50 rounded-lg px-4"
                  >
                    <AccordionTrigger className="text-foreground hover:no-underline py-4">
                      <span className="text-start">
                        {isRTL ? faq.questionAr : faq.questionEn}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {isRTL ? faq.answerAr : faq.answerEn}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      )}

      {/* Related Services */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-8">
            {isRTL ? "خدمات أخرى قد تهمك" : "Other Services You May Like"}
          </h2>

          <div className="flex flex-wrap justify-center gap-3">
            {Object.entries(servicesContent)
              .filter(([key]) => key !== slug)
              .slice(0, 4)
              .map(([key, service]) => (
                <Link key={key} to={`/services/${key}`}>
                  <Button variant="outline" className="gap-2">
                    {isRTL ? service.heroTitleAr : service.heroTitleEn}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
