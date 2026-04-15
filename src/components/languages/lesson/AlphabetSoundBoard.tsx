import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, Check, Zap, Snail, Gauge, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchAndCacheTTS, playAudioUrl } from '@/lib/ttsCache';

interface WordEntry {
  word: string;
  translation: string;
}

interface LetterEntry {
  letter: string;
  lowercase: string;
  sound: string;
  words: WordEntry[];
  category: 'vowel' | 'consonant' | 'sign';
  speechText: string;
}

const RUSSIAN_ALPHABET: LetterEntry[] = [
  { letter: 'А', lowercase: 'а', sound: '/a/', category: 'vowel', speechText: 'А',
    words: [{ word: 'арбуз', translation: 'watermelon' }, { word: 'автобус', translation: 'bus' }, { word: 'луна', translation: 'moon' }] },
  { letter: 'Б', lowercase: 'б', sound: '/b/', category: 'consonant', speechText: 'Бэ',
    words: [{ word: 'банан', translation: 'banana' }, { word: 'брат', translation: 'brother' }, { word: 'хлеб', translation: 'bread' }] },
  { letter: 'В', lowercase: 'в', sound: '/v/', category: 'consonant', speechText: 'Вэ',
    words: [{ word: 'вода', translation: 'water' }, { word: 'время', translation: 'time' }, { word: 'вечер', translation: 'evening' }] },
  { letter: 'Г', lowercase: 'г', sound: '/g/', category: 'consonant', speechText: 'Гэ',
    words: [{ word: 'город', translation: 'city' }, { word: 'глаз', translation: 'eye' }, { word: 'друг', translation: 'friend' }] },
  { letter: 'Д', lowercase: 'д', sound: '/d/', category: 'consonant', speechText: 'Дэ',
    words: [{ word: 'дом', translation: 'house' }, { word: 'дерево', translation: 'tree' }, { word: 'обед', translation: 'lunch' }] },
  { letter: 'Е', lowercase: 'е', sound: '/je/', category: 'vowel', speechText: 'Е',
    words: [{ word: 'ехать', translation: 'to go' }, { word: 'если', translation: 'if' }, { word: 'море', translation: 'sea' }] },
  { letter: 'Ё', lowercase: 'ё', sound: '/jo/', category: 'vowel', speechText: 'Ё',
    words: [{ word: 'ёж', translation: 'hedgehog' }, { word: 'ёлка', translation: 'fir tree' }, { word: 'мёд', translation: 'honey' }] },
  { letter: 'Ж', lowercase: 'ж', sound: '/ʒ/', category: 'consonant', speechText: 'Жэ',
    words: [{ word: 'жизнь', translation: 'life' }, { word: 'жена', translation: 'wife' }, { word: 'нож', translation: 'knife' }] },
  { letter: 'З', lowercase: 'з', sound: '/z/', category: 'consonant', speechText: 'Зэ',
    words: [{ word: 'звезда', translation: 'star' }, { word: 'зима', translation: 'winter' }, { word: 'глаз', translation: 'eye' }] },
  { letter: 'И', lowercase: 'и', sound: '/i/', category: 'vowel', speechText: 'И',
    words: [{ word: 'игра', translation: 'game' }, { word: 'имя', translation: 'name' }, { word: 'книги', translation: 'books' }] },
  { letter: 'Й', lowercase: 'й', sound: '/j/', category: 'consonant', speechText: 'И краткое',
    words: [{ word: 'йогурт', translation: 'yogurt' }, { word: 'май', translation: 'May' }, { word: 'чай', translation: 'tea' }] },
  { letter: 'К', lowercase: 'к', sound: '/k/', category: 'consonant', speechText: 'Ка',
    words: [{ word: 'кот', translation: 'cat' }, { word: 'книга', translation: 'book' }, { word: 'урок', translation: 'lesson' }] },
  { letter: 'Л', lowercase: 'л', sound: '/l/', category: 'consonant', speechText: 'Эл',
    words: [{ word: 'лето', translation: 'summer' }, { word: 'любовь', translation: 'love' }, { word: 'стол', translation: 'table' }] },
  { letter: 'М', lowercase: 'м', sound: '/m/', category: 'consonant', speechText: 'Эм',
    words: [{ word: 'мама', translation: 'mama' }, { word: 'молоко', translation: 'milk' }, { word: 'дом', translation: 'house' }] },
  { letter: 'Н', lowercase: 'н', sound: '/n/', category: 'consonant', speechText: 'Эн',
    words: [{ word: 'небо', translation: 'sky' }, { word: 'ночь', translation: 'night' }, { word: 'сон', translation: 'sleep' }] },
  { letter: 'О', lowercase: 'о', sound: '/o/', category: 'vowel', speechText: 'О',
    words: [{ word: 'окно', translation: 'window' }, { word: 'озеро', translation: 'lake' }, { word: 'молоко', translation: 'milk' }] },
  { letter: 'П', lowercase: 'п', sound: '/p/', category: 'consonant', speechText: 'Пэ',
    words: [{ word: 'папа', translation: 'papa' }, { word: 'птица', translation: 'bird' }, { word: 'суп', translation: 'soup' }] },
  { letter: 'Р', lowercase: 'р', sound: '/r/', category: 'consonant', speechText: 'Эр',
    words: [{ word: 'рука', translation: 'hand' }, { word: 'работа', translation: 'work' }, { word: 'мир', translation: 'world' }] },
  { letter: 'С', lowercase: 'с', sound: '/s/', category: 'consonant', speechText: 'Эс',
    words: [{ word: 'солнце', translation: 'sun' }, { word: 'собака', translation: 'dog' }, { word: 'нос', translation: 'nose' }] },
  { letter: 'Т', lowercase: 'т', sound: '/t/', category: 'consonant', speechText: 'Тэ',
    words: [{ word: 'тело', translation: 'body' }, { word: 'трава', translation: 'grass' }, { word: 'кот', translation: 'cat' }] },
  { letter: 'У', lowercase: 'у', sound: '/u/', category: 'vowel', speechText: 'У',
    words: [{ word: 'утро', translation: 'morning' }, { word: 'улица', translation: 'street' }, { word: 'иду', translation: 'I go' }] },
  { letter: 'Ф', lowercase: 'ф', sound: '/f/', category: 'consonant', speechText: 'Эф',
    words: [{ word: 'фрукт', translation: 'fruit' }, { word: 'фильм', translation: 'film' }, { word: 'шкаф', translation: 'wardrobe' }] },
  { letter: 'Х', lowercase: 'х', sound: '/x/', category: 'consonant', speechText: 'Ха',
    words: [{ word: 'хлеб', translation: 'bread' }, { word: 'хорошо', translation: 'good' }, { word: 'отдых', translation: 'rest' }] },
  { letter: 'Ц', lowercase: 'ц', sound: '/ts/', category: 'consonant', speechText: 'Цэ',
    words: [{ word: 'цветок', translation: 'flower' }, { word: 'центр', translation: 'center' }, { word: 'отец', translation: 'father' }] },
  { letter: 'Ч', lowercase: 'ч', sound: '/tʃ/', category: 'consonant', speechText: 'Чэ',
    words: [{ word: 'час', translation: 'hour' }, { word: 'человек', translation: 'person' }, { word: 'ночь', translation: 'night' }] },
  { letter: 'Ш', lowercase: 'ш', sound: '/ʃ/', category: 'consonant', speechText: 'Ша',
    words: [{ word: 'школа', translation: 'school' }, { word: 'шапка', translation: 'hat' }, { word: 'карандаш', translation: 'pencil' }] },
  { letter: 'Щ', lowercase: 'щ', sound: '/ɕː/', category: 'consonant', speechText: 'Ща',
    words: [{ word: 'щенок', translation: 'puppy' }, { word: 'щука', translation: 'pike' }, { word: 'овощ', translation: 'vegetable' }] },
  { letter: 'Ъ', lowercase: 'ъ', sound: '—', category: 'sign', speechText: 'Твёрдый знак',
    words: [{ word: 'объект', translation: 'object' }, { word: 'подъезд', translation: 'entrance' }, { word: 'объём', translation: 'volume' }] },
  { letter: 'Ы', lowercase: 'ы', sound: '/ɨ/', category: 'vowel', speechText: 'Ы',
    words: [{ word: 'мы', translation: 'we' }, { word: 'сыр', translation: 'cheese' }, { word: 'рыба', translation: 'fish' }] },
  { letter: 'Ь', lowercase: 'ь', sound: '—', category: 'sign', speechText: 'Мягкий знак',
    words: [{ word: 'день', translation: 'day' }, { word: 'мать', translation: 'mother' }, { word: 'жизнь', translation: 'life' }] },
  { letter: 'Э', lowercase: 'э', sound: '/e/', category: 'vowel', speechText: 'Э',
    words: [{ word: 'это', translation: 'this' }, { word: 'этаж', translation: 'floor' }, { word: 'поэт', translation: 'poet' }] },
  { letter: 'Ю', lowercase: 'ю', sound: '/ju/', category: 'vowel', speechText: 'Ю',
    words: [{ word: 'юг', translation: 'south' }, { word: 'юбка', translation: 'skirt' }, { word: 'люблю', translation: 'I love' }] },
  { letter: 'Я', lowercase: 'я', sound: '/ja/', category: 'vowel', speechText: 'Я',
    words: [{ word: 'яблоко', translation: 'apple' }, { word: 'язык', translation: 'language' }, { word: 'семья', translation: 'family' }] },
];

const SPEED_OPTIONS = [
  { key: 'slow', rate: 0.75, icon: Snail },
  { key: 'normal', rate: 0.9, icon: Gauge },
  { key: 'fast', rate: 1.1, icon: Zap },
] as const;

const CATEGORY_COLORS = {
  vowel: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-600 dark:text-blue-400', activeBg: 'bg-blue-500', dot: 'bg-blue-500' },
  consonant: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', activeBg: 'bg-emerald-500', dot: 'bg-emerald-500' },
  sign: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', activeBg: 'bg-amber-500', dot: 'bg-amber-500' },
};

interface Props {
  title: string;
  onComplete: () => void;
  isCompleted: boolean;
}

export function AlphabetSoundBoard({ title, onComplete, isCompleted }: Props) {
  const { t } = useLanguage();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const [speedKey, setSpeedKey] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [tappedLetters, setTappedLetters] = useState<Set<number>>(new Set());
  const [loadingLetter, setLoadingLetter] = useState(false);
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const playingRef = useRef(false);
  const cancelRef = useRef(false);

  const speed = SPEED_OPTIONS.find(s => s.key === speedKey)!;

  const speakText = useCallback(async (text: string, rate: number): Promise<void> => {
    try {
      const audioUrl = await fetchAndCacheTTS(text, rate);
      await playAudioUrl(audioUrl);
    } catch (err) {
      console.warn('TTS error, fallback:', err);
      return new Promise((resolve) => {
        if (!window.speechSynthesis) { resolve(); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ru-RU'; u.rate = rate;
        const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('ru'));
        if (v) u.voice = v;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      });
    }
  }, []);

  // Preload first batch in background
  useEffect(() => {
    const preload = async () => {
      for (let i = 0; i < 10; i++) {
        try { await fetchAndCacheTTS(RUSSIAN_ALPHABET[i].speechText, speed.rate); } catch {}
      }
    };
    preload();
  }, [speed.rate]);

  const handleLetterTap = useCallback(async (idx: number) => {
    if (playingAll || loadingLetter) return;
    setSelectedIdx(idx);
    setActiveIdx(idx);
    setLoadingLetter(true);
    setTappedLetters(prev => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === RUSSIAN_ALPHABET.length && !isCompleted) {
        setTimeout(onComplete, 500);
      }
      return next;
    });

    const entry = RUSSIAN_ALPHABET[idx];
    try {
      await speakText(entry.speechText, speed.rate);
    } catch {}
    setActiveIdx(null);
    setLoadingLetter(false);
  }, [playingAll, loadingLetter, speed.rate, speakText, isCompleted, onComplete]);

  const handleWordTap = useCallback(async (word: string) => {
    if (playingWord) return;
    setPlayingWord(word);
    try {
      await speakText(word, speed.rate);
    } catch {}
    setPlayingWord(null);
  }, [playingWord, speed.rate, speakText]);

  const playAll = useCallback(async () => {
    if (playingRef.current) {
      cancelRef.current = true;
      setPlayingAll(false);
      setActiveIdx(null);
      playingRef.current = false;
      return;
    }

    playingRef.current = true;
    cancelRef.current = false;
    setPlayingAll(true);

    const delayBetween = speedKey === 'slow' ? 600 : speedKey === 'fast' ? 150 : 300;

    for (let i = 0; i < RUSSIAN_ALPHABET.length; i++) {
      if (cancelRef.current) break;
      setActiveIdx(i);
      setSelectedIdx(i);
      setTappedLetters(prev => new Set(prev).add(i));

      try {
        await speakText(RUSSIAN_ALPHABET[i].speechText, speed.rate);
      } catch {}
      if (cancelRef.current) break;
      await new Promise(r => setTimeout(r, delayBetween));
    }

    if (!cancelRef.current && !isCompleted) onComplete();

    setPlayingAll(false);
    setActiveIdx(null);
    playingRef.current = false;
    cancelRef.current = false;
  }, [speedKey, speed.rate, speakText, isCompleted, onComplete]);

  const selected = selectedIdx !== null ? RUSSIAN_ALPHABET[selectedIdx] : null;
  const progress = tappedLetters.size / RUSSIAN_ALPHABET.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-base">{title}</h3>
        {isCompleted && <span className="text-xs text-primary flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('languages.lesson.block.done')}</span>}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { key: 'vowel', label: t('languages.lesson.interactive.vowels', { defaultValue: 'Vowels (10)' }), color: CATEGORY_COLORS.vowel },
          { key: 'consonant', label: t('languages.lesson.interactive.consonants', { defaultValue: 'Consonants (21)' }), color: CATEGORY_COLORS.consonant },
          { key: 'sign', label: t('languages.lesson.interactive.signs', { defaultValue: 'Signs (2)' }), color: CATEGORY_COLORS.sign },
        ].map(item => (
          <div key={item.key} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", item.color.dot)} />
            <span className="text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
        </div>
        <span className="text-xs font-semibold text-primary">{tappedLetters.size}/33</span>
      </div>

      {/* Play all controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={playAll}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all",
            playingAll ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground hover:opacity-90"
          )}
        >
          {playingAll ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playingAll
            ? t('languages.lesson.interactive.stop', { defaultValue: 'Stop' })
            : t('languages.lesson.interactive.playAll', { defaultValue: 'Play All' })}
        </button>

        <div className="flex rounded-lg border border-border overflow-hidden">
          {SPEED_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                onClick={() => setSpeedKey(opt.key)}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1",
                  speedKey === opt.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`languages.lesson.interactive.speed_${opt.key}`, { defaultValue: opt.key })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Letter grid */}
      <div className="grid grid-cols-8 sm:grid-cols-11 lg:grid-cols-[repeat(17,minmax(0,1fr))] gap-1">
        {RUSSIAN_ALPHABET.map((entry, i) => {
          const colors = CATEGORY_COLORS[entry.category];
          const isActive = activeIdx === i;
          const isTapped = tappedLetters.has(i);
          const isSelected = selectedIdx === i;

          return (
            <motion.button
              key={entry.letter}
              whileTap={{ scale: 0.9 }}
              animate={isActive ? { scale: [1, 1.15, 1], transition: { duration: 0.3 } } : {}}
              onClick={() => handleLetterTap(i)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-md border p-0.5 h-10 w-full transition-all duration-150",
                isActive && `${colors.activeBg} text-white border-transparent shadow-lg`,
                !isActive && isSelected && `${colors.bg} ${colors.border} ${colors.text}`,
                !isActive && !isSelected && isTapped && `${colors.bg} border-transparent ${colors.text}`,
                !isActive && !isSelected && !isTapped && `bg-card border-border hover:${colors.border} text-foreground`,
              )}
            >
              {isActive && loadingLetter ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <>
                  <span className={cn("text-sm font-bold leading-none", isActive && "text-white")}>
                    {entry.letter}
                  </span>
                  <span className={cn("text-[8px] leading-none mt-0.5 opacity-60", isActive && "text-white/80")}>
                    {entry.lowercase}
                  </span>
                </>
              )}
              {isTapped && !isActive && (
                <div className={cn("absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full", colors.dot)} />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Detail panel with 3 words */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selectedIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "rounded-xl border-2 p-4 space-y-3",
              CATEGORY_COLORS[selected.category].border,
              CATEGORY_COLORS[selected.category].bg,
            )}
          >
            {/* Letter header */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleLetterTap(selectedIdx!)}
                className={cn(
                  "w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 transition-colors",
                  CATEGORY_COLORS[selected.category].activeBg, "text-white"
                )}
              >
                <span className="text-2xl font-bold">{selected.letter}</span>
                <span className="text-xs opacity-80">{selected.lowercase}</span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold text-foreground">{selected.letter}{selected.lowercase}</span>
                  <span className="text-sm font-mono text-muted-foreground">{selected.sound}</span>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    selected.category === 'vowel' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                    selected.category === 'consonant' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  )}>
                    {selected.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleLetterTap(selectedIdx!)}
                className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0"
              >
                <Volume2 className="w-5 h-5 text-primary" />
              </button>
            </div>

            {/* 3 example words - clickable */}
            <div className="grid grid-cols-3 gap-2">
              {selected.words.map((w) => {
                const isWordPlaying = playingWord === w.word;
                return (
                  <button
                    key={w.word}
                    onClick={() => handleWordTap(w.word)}
                    disabled={!!playingWord && !isWordPlaying}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all text-center",
                      isWordPlaying
                        ? "bg-primary/20 border-primary shadow-sm scale-[1.02]"
                        : "bg-background/50 border-border/50 hover:bg-background hover:border-primary/30 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {isWordPlaying ? (
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      ) : (
                        <Volume2 className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span className="font-bold text-sm text-foreground">{w.word}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{w.translation}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
