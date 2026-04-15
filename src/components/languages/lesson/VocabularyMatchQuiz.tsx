import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Loader2, CheckCircle, Trophy, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRussianTTS } from '@/hooks/useRussianTTS';

interface VocabItem {
  term: string;
  translation: string;
}

interface Props {
  vocabulary: VocabItem[];
  onComplete?: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function VocabularyMatchQuiz({ vocabulary, onComplete }: Props) {
  const { t } = useLanguage();
  const { speak, isSpeaking, speakingText } = useRussianTTS();

  const shuffledTranslations = useMemo(() => shuffleArray(vocabulary.map((v, i) => ({ ...v, origIdx: i }))), [vocabulary]);

  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ term: number; trans: number } | null>(null);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const allMatched = matched.size === vocabulary.length;

  const tryMatch = useCallback((termIdx: number, transIdx: number) => {
    setAttempts(a => a + 1);
    const translationItem = shuffledTranslations[transIdx];
    if (translationItem.origIdx === termIdx) {
      const newMatched = new Set(matched);
      newMatched.add(termIdx);
      setMatched(newMatched);
      setScore(s => s + 1);
      setSelectedTerm(null);
      setSelectedTranslation(null);
      setWrongPair(null);
      if (newMatched.size === vocabulary.length) {
        onComplete?.();
      }
    } else {
      setWrongPair({ term: termIdx, trans: transIdx });
      setTimeout(() => {
        setWrongPair(null);
        setSelectedTerm(null);
        setSelectedTranslation(null);
      }, 800);
    }
  }, [matched, shuffledTranslations, vocabulary.length, onComplete]);

  const handleTermClick = (idx: number) => {
    if (matched.has(idx)) return;
    setSelectedTerm(idx);
    setWrongPair(null);
    if (!isSpeaking) speak(vocabulary[idx].term);
    if (selectedTranslation !== null) tryMatch(idx, selectedTranslation);
  };

  const handleTranslationClick = (tIdx: number) => {
    const origIdx = shuffledTranslations[tIdx].origIdx;
    if (matched.has(origIdx)) return;
    setSelectedTranslation(tIdx);
    setWrongPair(null);
    if (selectedTerm !== null) tryMatch(selectedTerm, tIdx);
  };

  const handleReset = () => {
    setMatched(new Set());
    setSelectedTerm(null);
    setSelectedTranslation(null);
    setWrongPair(null);
    setScore(0);
    setAttempts(0);
  };

  if (vocabulary.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-5 mb-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">
            {t('languages.lesson.vocabQuiz.title', { defaultValue: 'Vocabulary Quiz' })}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {t('languages.lesson.vocabQuiz.progress', {
            defaultValue: '{{matched}} / {{total}}',
            matched: matched.size,
            total: vocabulary.length,
          })}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {t('languages.lesson.vocabQuiz.instruction', {
          defaultValue: 'Match each word with its correct meaning',
        })}
      </p>

      {/* Completion state */}
      {allMatched ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-6 space-y-3"
        >
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="font-bold text-foreground">
            {t('languages.lesson.vocabQuiz.complete', { defaultValue: 'Excellent! All matched!' })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('languages.lesson.vocabQuiz.score', {
              defaultValue: '{{score}} correct out of {{attempts}} attempts',
              score,
              attempts,
            })}
          </p>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('languages.lesson.vocabQuiz.retry', { defaultValue: 'Try again' })}
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Terms column */}
          <div className="space-y-2">
            {vocabulary.map((v, idx) => {
              const isMatched = matched.has(idx);
              const isSelected = selectedTerm === idx;
              const isWrong = wrongPair?.term === idx;
              const isThisSpeaking = speakingText === v.term;

              return (
                <motion.button
                  key={`term-${idx}`}
                  onClick={() => handleTermClick(idx)}
                  disabled={isMatched}
                  whileTap={!isMatched ? { scale: 0.97 } : undefined}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all border min-w-0',
                    isMatched
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 opacity-60'
                      : isWrong
                        ? 'bg-destructive/10 border-destructive/30 text-destructive animate-shake'
                        : isSelected
                          ? 'bg-primary/10 border-primary/40 text-primary ring-2 ring-primary/20'
                          : 'bg-muted/30 border-border hover:bg-muted/60 text-foreground'
                  )}
                >
                  {isThisSpeaking ? (
                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  )}
                  <span className="truncate">{v.term}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Translations column (shuffled) */}
          <div className="space-y-2">
            {shuffledTranslations.map((item, tIdx) => {
              const isMatched = matched.has(item.origIdx);
              const isSelected = selectedTranslation === tIdx;
              const isWrong = wrongPair?.trans === tIdx;

              return (
                <motion.button
                  key={`trans-${tIdx}`}
                  onClick={() => handleTranslationClick(tIdx)}
                  disabled={isMatched}
                  whileTap={!isMatched ? { scale: 0.97 } : undefined}
                  className={cn(
                    'w-full text-left rounded-xl px-3 py-2.5 text-sm transition-all border min-w-0',
                    isMatched
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 opacity-60'
                      : isWrong
                        ? 'bg-destructive/10 border-destructive/30 text-destructive animate-shake'
                        : isSelected
                          ? 'bg-primary/10 border-primary/40 text-primary ring-2 ring-primary/20'
                          : 'bg-muted/30 border-border hover:bg-muted/60 text-foreground'
                  )}
                >
                  <span className="truncate block">{item.translation}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
