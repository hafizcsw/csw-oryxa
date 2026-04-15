import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Lock, Trash2, Eye, FileText, Users, Mail,
  Database, CheckCircle2, GraduationCap, CalendarDays,
  ClipboardList, UserCircle, ArrowUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

interface SectionDef {
  key: string;
  icon: LucideIcon;
  color: string;
}

const sections: SectionDef[] = [
  { key: "intro", icon: FileText, color: "text-blue-500" },
  { key: "personalData", icon: UserCircle, color: "text-amber-500" },
  { key: "sessionData", icon: CalendarDays, color: "text-emerald-500" },
  { key: "evaluationData", icon: ClipboardList, color: "text-purple-500" },
  { key: "documentsData", icon: Database, color: "text-cyan-500" },
  { key: "howWeUse", icon: Eye, color: "text-indigo-500" },
  { key: "dataSharing", icon: Users, color: "text-rose-500" },
  { key: "security", icon: Lock, color: "text-yellow-500" },
  { key: "rights", icon: Shield, color: "text-green-500" },
  { key: "deleteRequest", icon: Trash2, color: "text-red-500" },
  { key: "contact", icon: Mail, color: "text-teal-500" },
];

export default function TeacherPrivacyPolicy() {
  const { t } = useLanguage();
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const handler = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const tSection = (sectionKey: string, field: string) =>
    t(`legal.teacherPrivacy.sections.${sectionKey}.${field}`, { defaultValue: "" });

  const tItems = (sectionKey: string, count: number) =>
    Array.from({ length: count }, (_, i) => {
      const key = `legal.teacherPrivacy.sections.${sectionKey}.items.${i}`;
      const val = t(key, { defaultValue: "" });
      // t() returns the key itself when missing — filter those out
      return val && val !== key ? val : "";
    }).filter(Boolean);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-primary/5 py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {t("legal.teacherPrivacy.badge", { defaultValue: "Teacher Privacy Policy" })}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                {t("legal.teacherPrivacy.title", { defaultValue: "Teacher Privacy Policy & Data Protection" })}
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t("legal.teacherPrivacy.subtitle", { defaultValue: "How we collect, use, and protect your data as a teacher on our platform" })}
              </p>
              <Badge variant="outline" className="text-xs">
                {t("legal.teacherPrivacy.lastUpdated", { defaultValue: "Last updated" })}: {new Date().toLocaleDateString()}
              </Badge>
            </motion.div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
          {sections.map((section, index) => (
            <motion.div
              key={section.key}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className="p-6 sm:p-8 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-muted shrink-0", section.color)}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <h2 className="text-xl font-bold text-foreground">
                      {tSection(section.key, "title")}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {tSection(section.key, "body")}
                    </p>

                    {/* Items list if present */}
                    {(() => {
                      const items = tItems(section.key, 10);
                      if (items.length === 0) return null;
                      return (
                        <ul className="space-y-2 pt-2">
                          {items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}

                    {/* CTA for delete/contact */}
                    {(section.key === "deleteRequest" || section.key === "contact") && (
                      <div className="pt-3">
                        <a
                          href="mailto:privacy@connectstudyworld.com"
                          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                          <Mail className="w-4 h-4" />
                          privacy@connectstudyworld.com
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Scroll to top */}
        {showTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 end-6 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}
      </div>
    </Layout>
  );
}
