import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Shuffle, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRussianTTS } from '@/hooks/useRussianTTS';

interface Pair { left: string; right: string }

interface Props {
  prompt: string;
  pairs: Pair[];
  title: string;
  onComplete: () => void;
  isCompleted: boolean;
}

export function InteractiveMatching({ prompt, pairs, title, onComplete, isCompleted }: Props) {
  const { t } = useLanguage();
  const { speak, isSpeaking, speakingText } = useRussianTTS();
  const shuffledRight = useMemo(() => [...pairs].sort(() => Math.random() - 0.5), [pairs]);

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ left: number; right: number } | null>(null);

  const handleLeft = (idx: number) => {
    if (matched.has(idx)) return;
    setSelectedLeft(idx);
    setWrongPair(null);
    // Speak left text
    if (!isSpeaking) speak(pairs[idx].left);
    if (selectedRight !== null) tryMatch(idx, selectedRight);
  };

  const handleRight = (rIdx: number) => {
    const actualIdx = pairs.indexOf(shuffledRight[rIdx]);
    if (matched.has(actualIdx)) return;
    setSelectedRight(rIdx);
    setWrongPair(null);
    // Speak right text
    if (!isSpeaking) speak(shuffledRight[rIdx].right);
    if (selectedLeft !== null) tryMatch(selectedLeft, rIdx);
  };

  const tryMatch = (leftIdx: number, rightIdx: number) => {
    const rightPair = shuffledRight[rightIdx];
    const leftPair = pairs[leftIdx];
    if (leftPair.left === rightPair.left && leftPair.right === rightPair.right) {
      setMatched(prev => {
        const next = new Set(prev);
        next.add(leftIdx);
        if (next.size === pairs.length && !isCompleted) setTimeout(onComplete, 600);
        return next;
      });
      setSelectedLeft(null);
      setSelectedRight(null);
    } else {
      setWrongPair({ left: leftIdx, right: rightIdx });
      setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 800);
    }
  };

  const progress = matched.size / pairs.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        {isCompleted && <span className="text-xs text-primary flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('languages.lesson.block.done')}</span>}
      </div>

      <p className="text-sm text-foreground">{prompt}</p>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {pairs.map((p, i) => {
            const isMatched = matched.has(i);
            const isActive = selectedLeft === i;
            const isWrong = wrongPair?.left === i;

            return (
              <motion.button
                key={`l-${i}`}
                whileTap={!isMatched ? { scale: 0.95 } : undefined}
                onClick={() => handleLeft(i)}
                className={cn(
                  "w-full rounded-xl border-2 p-3 text-sm font-medium text-left transition-all",
                  isMatched && "border-green-400/50 bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-400 line-through opacity-70",
                  isActive && !isMatched && "border-primary bg-primary/10 text-primary",
                  isWrong && "border-destructive bg-destructive/5 text-destructive",
                  !isMatched && !isActive && !isWrong && "border-border bg-card hover:border-primary/30 text-foreground"
                )}
              >
                {p.left}
              </motion.button>
            );
          })}
        </div>

        <div className="space-y-2">
          {shuffledRight.map((p, i) => {
            const actualIdx = pairs.indexOf(p);
            const isMatched = matched.has(actualIdx);
            const isActive = selectedRight === i;
            const isWrong = wrongPair?.right === i;

            return (
              <motion.button
                key={`r-${i}`}
                whileTap={!isMatched ? { scale: 0.95 } : undefined}
                onClick={() => handleRight(i)}
                className={cn(
                  "w-full rounded-xl border-2 p-3 text-sm font-medium text-left transition-all",
                  isMatched && "border-green-400/50 bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-400 line-through opacity-70",
                  isActive && !isMatched && "border-primary bg-primary/10 text-primary",
                  isWrong && "border-destructive bg-destructive/5 text-destructive",
                  !isMatched && !isActive && !isWrong && "border-border bg-card hover:border-primary/30 text-foreground"
                )}
              >
                {p.right}
              </motion.button>
            );
          })}
        </div>
      </div>

      {matched.size === pairs.length && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-center">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">🎯 {t('languages.lesson.interactive.allMatched', { defaultValue: 'All matched!' })}</p>
        </motion.div>
      )}
    </div>
  );
}
