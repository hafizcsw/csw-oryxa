import { motion, AnimatePresence } from 'framer-motion';
import { GitCompare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCompare, MAX_COMPARE } from '@/hooks/useCompare';
import { useLanguage } from '@/contexts/LanguageContext';

interface CompareFloatingBarProps {
  onCompareClick: () => void;
  position?: 'bottom' | 'top';
  className?: string;
}

export function CompareFloatingBar({
  onCompareClick,
  position = 'bottom',
  className = ''
}: CompareFloatingBarProps) {
  const { count, clearCompare, canCompare } = useCompare();
  const { t } = useLanguage();

  if (!canCompare) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
        className={`
          fixed ${position === 'bottom' ? 'bottom-20 sm:bottom-6' : 'top-20'}
          left-1/2 -translate-x-1/2 z-50
          flex items-center gap-3
          px-4 py-3 rounded-full
          bg-primary text-primary-foreground
          shadow-xl shadow-primary/25
          backdrop-blur-sm
          ${className}
        `}
      >
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5" />
          <span className="font-medium">{t('compare.drawer.title')}</span>
          <Badge
            variant="secondary"
            className="bg-primary-foreground/20 text-primary-foreground border-0"
          >
            {count}/{MAX_COMPARE}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onCompareClick}
            className="rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold"
          >
            <GitCompare className="w-4 h-4 mr-1" />
            {t('compare.drawer.compareNow')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={clearCompare}
            className="rounded-full text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 p-2"
            aria-label={t('compare.drawer.clearAll')}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
