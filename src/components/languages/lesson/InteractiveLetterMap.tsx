import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRussianTTS } from '@/hooks/useRussianTTS';

interface Mapping {
  grapheme: string;
  sound: string;
  example: string;
}

interface Props {
  mappings: Mapping[];
  title: string;
  onComplete: () => void;
  isCompleted: boolean;
}

export function InteractiveLetterMap({ mappings, title, onComplete, isCompleted }: Props) {
  const { t } = useLanguage();
  const { speak, isSpeaking, speakingText } = useRussianTTS();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [revealedSet, setRevealedSet] = useState<Set<number>>(new Set());

  const handleTap = useCallback(async (idx: number) => {
    if (isSpeaking) return;
    setSelectedIdx(idx);
    setRevealedSet(prev => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === mappings.length && !isCompleted) {
        setTimeout(onComplete, 600);
      }
      return next;
    });
    // Speak the letter
    const m = mappings[idx];
    const letterText = m.grapheme.split(' ')[0];
    await speak(letterText);
  }, [isSpeaking, mappings, isCompleted, onComplete, speak]);

  const handleSpeakExample = useCallback(async (text: string) => {
    if (isSpeaking) return;
    await speak(text);
  }, [isSpeaking, speak]);

  const selected = selectedIdx !== null ? mappings[selectedIdx] : null;
  const progress = revealedSet.size / mappings.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        {isCompleted && <span className="text-xs text-primary flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('languages.lesson.block.done')}</span>}
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-9 xl:grid-cols-11 gap-1.5">
        {mappings.map((m, i) => {
          const isRevealed = revealedSet.has(i);
          const isActive = selectedIdx === i;
          const letterText = m.grapheme.split(' ')[0];
          const isThisSpeaking = speakingText === letterText;

          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleTap(i)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 p-1.5 min-h-[48px] transition-all duration-200 cursor-pointer",
                isActive ? "border-primary bg-primary/10 shadow-md shadow-primary/20" :
                isRevealed ? "border-primary/30 bg-primary/5" :
                "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
              )}
            >
              {isThisSpeaking ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <span className={cn("text-lg font-bold leading-none",
                  isActive ? "text-primary" : isRevealed ? "text-primary/80" : "text-foreground"
                )}>
                  {letterText}
                </span>
              )}
              {isRevealed && !isThisSpeaking && (
                <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-muted-foreground mt-0.5">
                  {m.sound}
                </motion.span>
              )}
              {isRevealed && !isActive && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-2 h-2 text-primary-foreground" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selectedIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-primary">{selected.grapheme.split(' ')[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-foreground">{selected.grapheme}</span>
                <span className="text-sm text-primary font-mono">{selected.sound}</span>
              </div>
              <button 
                onClick={() => handleSpeakExample(selected.example)}
                className="text-sm text-muted-foreground mt-0.5 hover:text-primary transition-colors cursor-pointer"
              >
                🔊 {selected.example}
              </button>
            </div>
            <button 
              onClick={() => handleTap(selectedIdx!)}
              disabled={isSpeaking}
              className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
            >
              {isSpeaking ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Volume2 className="w-5 h-5 text-primary" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
