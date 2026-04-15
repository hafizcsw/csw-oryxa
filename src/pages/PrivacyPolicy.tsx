import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Lock, Trash2, Eye, FileText, Users, Mail, Server, 
  Cookie, Globe, UserX, Scale, RefreshCw, Database, 
  ChevronRight, ArrowUp, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

interface SectionDef {
  key: string;
  icon: LucideIcon;
  color: string;
  hasItems?: boolean;
  itemCount?: number;
  hasCta?: boolean;
  hasAiNote?: boolean;
  hasThirdPartyNote?: boolean;
  hasSubtitle?: boolean;
  hasDetails?: boolean;
  detailCount?: number;
  hasOptOut?: boolean;
  hasNote?: boolean;
  hasDpo?: boolean;
  hasResponseTime?: boolean;
  hasScope?: boolean;
  isContact?: boolean;
}

const sections: SectionDef[] = [
  { key: "intro", icon: FileText, color: "text-blue-500", hasScope: true },
  { key: "dataCollected", icon: Database, color: "text-amber-500", hasItems: true, itemCount: 8, hasSubtitle: true },
  { key: "howWeUse", icon: Eye, color: "text-emerald-500", hasItems: true, itemCount: 6 },
  { key: "dataSharing", icon: Users, color: "text-purple-500", hasAiNote: true, hasThirdPartyNote: true },
  { key: "cookies", icon: Cookie, color: "text-orange-500", hasItems: true, itemCount: 4, hasOptOut: true },
  { key: "thirdParty", icon: Globe, color: "text-cyan-500", hasItems: true, itemCount: 4, hasNote: true },
  { key: "internationalTransfers", icon: Globe, color: "text-indigo-500" },
  { key: "retention", icon: Server, color: "text-rose-500", hasDetails: true, detailCount: 5 },
  { key: "rights", icon: Shield, color: "text-green-500", hasItems: true, itemCount: 8, hasSubtitle: true },
  { key: "deleteRequest", icon: Trash2, color: "text-red-500", hasCta: true, hasNote: true },
  { key: "security", icon: Lock, color: "text-yellow-500", hasItems: true, itemCount: 6 },
  { key: "minors", icon: UserX, color: "text-pink-500" },
  { key: "partnerDPA", icon: FileText, color: "text-teal-500", hasItems: true, itemCount: 5 },
  { key: "updates", icon: RefreshCw, color: "text-violet-500" },
  { key: "legal", icon: Scale, color: "text-sky-500", hasItems: true, itemCount: 4 },
  { key: "contact", icon: Mail, color: "text-primary", isContact: true, hasDpo: true, hasResponseTime: true },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function PrivacyPolicy() {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (key: string) => {
    document.getElementById(`privacy-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Layout>
      <div className={cn("min-h-screen bg-background", isRTL && "text-right")} dir={isRTL ? "rtl" : "ltr"}>
        
        {/* Hero Header */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-primary/3 to-background border-b border-border/50">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--primary) / 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 50%, hsl(var(--primary) / 0.05) 0%, transparent 50%)',
          }} />
          <div className="relative container mx-auto px-6 py-16 sm:py-20 max-w-5xl">
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 mb-8 shadow-lg shadow-primary/10">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-4 tracking-tight">
                {t("legal.privacyPage.title")}
              </h1>
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Badge variant="secondary" className="gap-1.5 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  {t("legal.privacyPage.lastUpdated")}: {new Date("2026-03-14").toLocaleDateString(
                    isRTL ? "ar" : language === "ru" ? "ru" : language === "fr" ? "fr" : language === "es" ? "es" : "en",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </Badge>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="container mx-auto px-6 py-12 max-w-3xl">
            {/* Main Content */}
            <div className="space-y-6">
              {sections.map((sec, index) => {
                const Icon = sec.icon;
                const prefix = `legal.privacyPage.sections.${sec.key}`;

                return (
                  <motion.div
                    key={sec.key}
                    id={`privacy-${sec.key}`}
                    custom={index}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                  >
                    <Card className="p-6 sm:p-8 hover:shadow-md transition-shadow border-border/60 group">
                      <div className={cn("flex items-start gap-4 sm:gap-5", isRTL && "flex-row-reverse")}>
                        {/* Icon */}
                        <div className={cn(
                          "flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center mt-0.5 transition-transform group-hover:scale-105",
                          "bg-gradient-to-br from-muted to-muted/50 border border-border/50"
                        )}>
                          <Icon className={cn("w-6 h-6", sec.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Section number + title */}
                          <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted/50 px-2 py-0.5 rounded-md">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                              {t(`${prefix}.title`)}
                            </h2>
                          </div>

                          {/* Subtitle */}
                          {sec.hasSubtitle && (
                            <p className="text-sm text-muted-foreground mb-4 font-medium">
                              {t(`${prefix}.subtitle`)}
                            </p>
                          )}

                          {/* Content text */}
                          {!sec.hasItems && !sec.hasDetails && (
                            <p className="text-muted-foreground leading-relaxed mb-3">
                              {t(`${prefix}.content`)}
                            </p>
                          )}
                          
                          {(sec.hasItems || sec.hasDetails) && t(`${prefix}.content`) !== `${prefix}.content` && (
                            <p className="text-muted-foreground leading-relaxed mb-4">
                              {t(`${prefix}.content`)}
                            </p>
                          )}

                          {/* Scope (intro) */}
                          {sec.hasScope && (
                            <p className="text-sm text-muted-foreground/80 bg-muted/30 rounded-xl p-4 border border-border/30 mt-3">
                              {t(`${prefix}.scope`)}
                            </p>
                          )}

                          {/* AI Note */}
                          {sec.hasAiNote && (
                            <div className="flex items-start gap-2 bg-primary/5 rounded-xl p-4 border border-primary/10 mb-3 mt-3">
                              <span className="text-primary text-lg mt-0.5">🤖</span>
                              <p className="text-sm text-muted-foreground italic">
                                {t(`${prefix}.aiNote`)}
                              </p>
                            </div>
                          )}

                          {/* Third party note */}
                          {sec.hasThirdPartyNote && (
                            <div className="flex items-start gap-2 bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/10 mt-3">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              <p className="text-sm text-muted-foreground font-medium">
                                {t(`${prefix}.thirdPartyNote`)}
                              </p>
                            </div>
                          )}

                          {/* Items list */}
                          {sec.hasItems && sec.itemCount && (
                            <ul className="space-y-2.5 mt-4">
                              {Array.from({ length: sec.itemCount }, (_, i) => (
                                <li key={i} className={cn(
                                  "text-muted-foreground flex items-start gap-3 text-sm",
                                  isRTL && "flex-row-reverse"
                                )}>
                                  <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", 
                                    sec.color.replace('text-', 'bg-')
                                  )} />
                                  <span className="leading-relaxed">{t(`${prefix}.items.${i}`)}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* Details (retention) */}
                          {sec.hasDetails && sec.detailCount && (
                            <div className="mt-4 space-y-2">
                              {Array.from({ length: sec.detailCount }, (_, i) => (
                                <div key={i} className={cn(
                                  "flex items-start gap-3 text-sm bg-muted/30 rounded-lg p-3",
                                  isRTL && "flex-row-reverse"
                                )}>
                                  <Server className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                                  <span className="text-muted-foreground leading-relaxed">
                                    {t(`${prefix}.details.${i}`)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Opt-out */}
                          {sec.hasOptOut && (
                            <div className="mt-4 bg-amber-500/5 rounded-xl p-4 border border-amber-500/10">
                              <p className="text-sm text-muted-foreground">
                                {t(`${prefix}.optOut`)}
                              </p>
                            </div>
                          )}

                          {/* Note */}
                          {sec.hasNote && (
                            <p className="text-xs text-muted-foreground/70 mt-3 italic">
                              {t(`${prefix}.note`)}
                            </p>
                          )}

                          {/* CTA button */}
                          {sec.hasCta && (
                            <Button variant="destructive" className="mt-5 gap-2" asChild>
                <a href="mailto:privacy@connectstudyworld.com">
                                <Trash2 className="w-4 h-4" />
                                {t(`${prefix}.cta`)}
                              </a>
                            </Button>
                          )}

                          {/* Contact section */}
                          {sec.isContact && (
                            <div className="mt-4 space-y-3">
                              <a 
                                 href="mailto:privacy@connectstudyworld.com" 
                                className="inline-flex items-center gap-2 text-primary hover:underline font-semibold text-lg"
                              >
                                <Mail className="w-5 h-5" />
                                privacy@connectstudyworld.com
                              </a>
                              {sec.hasDpo && (
                                <Badge variant="outline" className="block w-fit text-xs gap-1.5">
                                  <Shield className="w-3 h-3" />
                                  {t(`${prefix}.dpo`)}
                                </Badge>
                              )}
                              {sec.hasResponseTime && (
                                <p className="text-sm text-muted-foreground/70">
                                  {t(`${prefix}.responseTime`)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
        </div>

        {/* Scroll to top */}
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-8 right-8 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </div>
    </Layout>
  );
}
