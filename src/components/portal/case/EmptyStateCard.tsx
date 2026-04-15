import { motion } from "framer-motion";
import { FileSearch, Sparkles, ArrowRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface EmptyStateCardProps {
  type: 'no_application' | 'error' | 'no_data';
  error?: string;
  onRetry?: () => void;
  onNavigate?: () => void;
}

export function EmptyStateCard({ type, error, onRetry, onNavigate }: EmptyStateCardProps) {
  const { t } = useLanguage();
  
  const content = {
    no_application: {
      icon: FolderOpen,
      title: t('portal.emptyState.selectApplication'),
      subtitle: t('portal.emptyState.selectApplicationDesc'),
      buttonText: t('portal.emptyState.viewApplications'),
      gradient: 'from-primary/20 via-primary/10 to-transparent'
    },
    error: {
      icon: FileSearch,
      title: t('portal.emptyState.errorOccurred'),
      subtitle: error || t('portal.emptyState.loadFailed'),
      buttonText: t('portal.emptyState.tryAgain'),
      gradient: 'from-destructive/20 via-destructive/10 to-transparent'
    },
    no_data: {
      icon: Sparkles,
      title: t('portal.emptyState.noDataYet'),
      subtitle: t('portal.emptyState.submitFirst'),
      buttonText: t('portal.emptyState.submitNew'),
      gradient: 'from-muted/50 via-muted/30 to-transparent'
    }
  };

  const { icon: Icon, title, subtitle, buttonText, gradient } = content[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden"
    >
      <div className={`
        relative rounded-3xl border border-border/50 
        bg-gradient-to-br ${gradient}
        backdrop-blur-xl p-8 md:p-12
        shadow-2xl shadow-primary/5
      `}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <motion.div
          animate={{ y: [0, -10, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 left-1/4 w-2 h-2 bg-primary/40 rounded-full"
        />
        <motion.div
          animate={{ y: [0, 10, 0], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute top-20 right-1/3 w-3 h-3 bg-primary/30 rounded-full"
        />
        <motion.div
          animate={{ y: [0, -8, 0], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-20 right-1/4 w-1.5 h-1.5 bg-primary/50 rounded-full"
        />

        <div className="relative z-10 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative mb-6 p-6 rounded-2xl bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border border-border/30 shadow-lg"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent blur-xl opacity-50" />
            <Icon className={`relative h-12 w-12 md:h-16 md:w-16 ${type === 'error' ? 'text-destructive' : 'text-primary'}`} />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-2xl md:text-3xl font-bold mb-3 text-foreground"
          >
            {title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-muted-foreground text-base md:text-lg max-w-md mb-8 leading-relaxed"
          >
            {subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Button
              size="lg"
              onClick={type === 'error' ? onRetry : onNavigate}
              className={`
                group relative overflow-hidden
                px-8 py-6 text-base font-medium
                rounded-xl shadow-lg
                ${type === 'error' 
                  ? 'bg-destructive hover:bg-destructive/90' 
                  : 'bg-primary hover:bg-primary/90'
                }
                transition-all duration-300
                hover:shadow-xl hover:scale-105
              `}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center gap-2">
                {buttonText}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
          </motion.div>

          {type === 'no_application' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-6 text-sm text-muted-foreground/70"
            >
              {t('portal.emptyState.tipFavorites')}
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
