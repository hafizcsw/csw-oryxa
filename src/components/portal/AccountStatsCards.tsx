import { motion } from "framer-motion";
import { FileText, Paperclip, Wallet, GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AccountStatsCardsProps {
  progress: number;
  docsCount: number;
  docsTotal: number;
  paymentPaid: number;
  paymentRequired: number;
  applicationsCount: number;
}

export function AccountStatsCards({
  progress,
  docsCount,
  docsTotal,
  paymentPaid,
  paymentRequired,
  applicationsCount,
}: AccountStatsCardsProps) {
  const { t } = useLanguage();
  const remaining = Math.max(0, paymentRequired - paymentPaid);

  const stats = [
    {
      icon: FileText,
      label: t('portal.stats.profile'),
      value: `${progress}%`,
      sublabel: t('portal.stats.complete'),
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20",
    },
    {
      icon: Paperclip,
      label: t('portal.sidebar.documents'),
      value: `${docsCount}/${docsTotal}`,
      sublabel: t('portal.stats.uploaded'),
      color: "text-info",
      bgColor: "bg-info/10",
      borderColor: "border-info/20",
    },
    {
      icon: Wallet,
      label: t('portal.sidebar.wallet'),
      value: `$${paymentPaid.toLocaleString()}`,
      sublabel: remaining > 0 ? `${t('portal.stats.remaining')} $${remaining.toLocaleString()}` : t('portal.stats.fullyPaid'),
      color: "text-success",
      bgColor: "bg-success/10",
      borderColor: "border-success/20",
    },
    {
      icon: GraduationCap,
      label: t('portal.sidebar.applications'),
      value: applicationsCount.toString(),
      sublabel: t('portal.stats.admissionRequest'),
      color: "text-accent",
      bgColor: "bg-accent/10",
      borderColor: "border-accent/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative overflow-hidden rounded-xl border ${stat.borderColor} bg-card p-4 shadow-sm hover:shadow-md transition-shadow min-h-[140px]`}
          >
            <div className={`absolute top-0 right-0 w-16 h-16 ${stat.bgColor} rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-50`} />
            
            <div className="relative">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${stat.bgColor} mb-3`}>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-xl md:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.sublabel}</p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
