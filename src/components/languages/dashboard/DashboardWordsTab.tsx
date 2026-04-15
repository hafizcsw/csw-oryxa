import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Brain, Star, RefreshCw, Check, BookOpen, ArrowUpRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Module } from "@/lib/russianCourse";
import type { VocabItem } from "@/hooks/useLearningState";
import { translateLanguageCourseValue } from "@/lib/languageCourseI18n";
import { StudentOperatingSystemTabContext } from '@/components/languages/dashboard/StudentOperatingSystemTabContext';
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';

interface Props {
  operatingSystemData?: StudentOperatingSystemData | null;
  vocabItems: VocabItem[];
  onUpdateMastery: (wordRu: string, mastery: VocabItem['mastery']) => void;
  pathModules: Module[];
}

const MASTERY_CONFIG: Record<string, { labelKey: string; color: string; bg: string; gradient: string }> = {
  new: { labelKey: "languages.dashboard.mastery.new", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", gradient: "from-sky-500 to-blue-600" },
  learning: { labelKey: "languages.dashboard.mastery.learning", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", gradient: "from-amber-500 to-orange-600" },
  familiar: { labelKey: "languages.dashboard.mastery.familiar", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", gradient: "from-emerald-500 to-green-600" },
  mastered: { labelKey: "languages.dashboard.mastery.mastered", color: "text-primary", bg: "bg-primary/10", gradient: "from-primary to-primary/80" },
};

const MASTERY_LEVELS: VocabItem['mastery'][] = ['new', 'learning', 'familiar', 'mastered'];
const NEXT_MASTERY: Record<string, VocabItem['mastery']> = { new: 'learning', learning: 'familiar', familiar: 'mastered', mastered: 'mastered' };

type FilterKey = 'all' | 'new' | 'learning' | 'familiar' | 'mastered' | 'review';

function MasteryBar({ mastery }: { mastery: string }) {
  const idx = MASTERY_LEVELS.indexOf(mastery as VocabItem['mastery']);
  return (
    <div className="flex gap-0.5">
      {MASTERY_LEVELS.map((_, i) => (
        <div key={i} className={cn(
          "h-1.5 rounded-full transition-all",
          i === 0 ? "w-3" : "w-3",
          i <= idx ? "bg-primary" : "bg-muted"
        )} />
      ))}
    </div>
  );
}

export function DashboardWordsTab({ vocabItems, onUpdateMastery, pathModules, operatingSystemData }: Props) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const formatWordFilter = (filterKey: FilterKey) => translateLanguageCourseValue(t, `languages.dashboard.wordFilter.${filterKey}`, filterKey);

  const counts = useMemo(() => ({
    total: vocabItems.length,
    mastered: vocabItems.filter(v => v.mastery === 'mastered').length,
    review: vocabItems.filter(v => v.mastery === 'new' || v.mastery === 'learning').length,
    familiar: vocabItems.filter(v => v.mastery === 'familiar').length,
    new: vocabItems.filter(v => v.mastery === 'new').length,
    learning: vocabItems.filter(v => v.mastery === 'learning').length,
  }), [vocabItems]);

  const masteryPercent = counts.total > 0 ? Math.round((counts.mastered / counts.total) * 100) : 0;

  const filtered = filter === 'all' ? vocabItems
    : filter === 'review' ? vocabItems.filter(v => v.mastery === 'new' || v.mastery === 'learning')
    : vocabItems.filter(v => v.mastery === filter);

  if (vocabItems.length === 0) {
    return (
      <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Brain className="w-8 h-8 text-primary" />
        </div>
        <h3 className="font-bold text-foreground mb-1">{t("languages.dashboard.noWords")}</h3>
        <p className="text-sm text-muted-foreground">{t("languages.dashboard.noWordsDesc")}</p>
      </motion.div>
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Summary cards ─── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-4 gap-2">
        {[
          { icon: BookOpen, value: counts.total, label: t("languages.dashboard.totalWords"), color: "text-sky-500" },
          { icon: Star, value: counts.mastered, label: t("languages.dashboard.mastery.mastered"), color: "text-primary" },
          { icon: RefreshCw, value: counts.review, label: t("languages.dashboard.wordsReview"), color: "text-amber-500" },
          { icon: Check, value: counts.familiar, label: t("languages.dashboard.mastery.familiar"), color: "text-emerald-500" },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-2xl border border-border p-3 text-center">
            <s.icon className={cn("w-5 h-5 mx-auto mb-1.5", s.color)} />
            <p className="text-xl font-extrabold text-foreground">{s.value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* ─── Mastery distribution bar ─── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
        className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("languages.dashboard.masteryDistribution")}</span>
          <span className="text-xs font-bold text-primary">{masteryPercent}% {t("languages.dashboard.mastery.mastered")}</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex bg-muted">
          {counts.total > 0 && MASTERY_LEVELS.map(level => {
            const count = vocabItems.filter(v => v.mastery === level).length;
            const pct = (count / counts.total) * 100;
            if (pct === 0) return null;
            const config = MASTERY_CONFIG[level];
            return (
              <motion.div
                key={level}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className={cn("h-full bg-gradient-to-r", config.gradient)}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          {MASTERY_LEVELS.map(level => {
            const config = MASTERY_CONFIG[level];
            const count = vocabItems.filter(v => v.mastery === level).length;
            return (
              <div key={level} className="flex items-center gap-1">
                <div className={cn("w-2 h-2 rounded-full bg-gradient-to-r", config.gradient)} />
                <span className="text-[10px] text-muted-foreground">{t(config.labelKey)} ({count})</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'review', 'new', 'learning', 'familiar', 'mastered'] as FilterKey[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30"
            )}
          >
            {formatWordFilter(f)}
            {f === 'review' && counts.review > 0 && <span className="ms-1">({counts.review})</span>}
          </button>
        ))}
      </div>

      {/* ─── Word cards ─── */}
      <div className="space-y-2">
        {filtered.map((word, i) => {
          const config = MASTERY_CONFIG[word.mastery] || MASTERY_CONFIG.new;
          const isExpanded = expandedWord === word.word_ru;
          const canUpgrade = word.mastery !== 'mastered';

          return (
            <motion.div
              key={word.id || i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.2) }}
              className={cn("bg-card rounded-2xl border-2 overflow-hidden transition-all",
                isExpanded ? "border-primary/30 shadow-md" : "border-border"
              )}
            >
              <div className="p-3.5 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedWord(isExpanded ? null : word.word_ru)}>
                {/* Letter circle with gradient */}
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br text-white text-sm font-bold", config.gradient)}>
                  {word.word_ru.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{word.word_ru}</p>
                  <p className="text-xs text-muted-foreground">{word.word_meaning}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={cn("text-[10px] font-semibold", config.color)}>{t(config.labelKey)}</span>
                  <MasteryBar mastery={word.mastery} />
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border"
                  >
                    <div className="p-3.5 space-y-3">
                      {word.transliteration && (
                        <p className="text-xs text-muted-foreground italic">📝 {word.transliteration}</p>
                      )}
                      {word.module_slug && (
                        <p className="text-[11px] text-muted-foreground">
                          📚 {(() => {
                            const mod = pathModules.find(m => m.slug === word.module_slug);
                            return mod ? t(mod.titleKey) : word.module_slug;
                          })()}
                        </p>
                      )}
                      {canUpgrade && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onUpdateMastery(word.word_ru, NEXT_MASTERY[word.mastery]); }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          {t("languages.dashboard.upgradeMastery")}
                        </button>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {MASTERY_LEVELS.filter(l => l !== word.mastery).map(level => {
                          const lConfig = MASTERY_CONFIG[level];
                          return (
                            <button
                              key={level}
                              onClick={(e) => { e.stopPropagation(); onUpdateMastery(word.word_ru, level); }}
                              className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium transition-all hover:scale-105", lConfig.bg, lConfig.color)}
                            >
                              {t(lConfig.labelKey)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t("languages.dashboard.noFilteredWords")}
          </div>
        )}
      </div>
    </div>
  );
}
