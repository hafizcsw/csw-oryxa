/**
 * useLessonProgress — Local + DB synced lesson progress tracking
 * Tracks block completions, mastered words, and daily streaks.
 * localStorage is the fast cache; Supabase is the persistent truth.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BLOCK_KEY = 'languages_russian_block_progress';
const MASTERED_KEY = 'languages_russian_mastered_words';
const STREAK_KEY = 'languages_russian_streak';

// ── Local helpers ──

function getLocalBlocks(): Record<string, Record<string, boolean>> {
  try { return JSON.parse(localStorage.getItem(BLOCK_KEY) || '{}'); } catch { return {}; }
}

function setLocalBlocks(data: Record<string, Record<string, boolean>>) {
  localStorage.setItem(BLOCK_KEY, JSON.stringify(data));
}

export interface MasteredWord {
  word: string;
  meaning: string;
  lessonSlug: string;
  masteredAt: string;
}

function getLocalMasteredWords(): MasteredWord[] {
  try { return JSON.parse(localStorage.getItem(MASTERED_KEY) || '[]'); } catch { return []; }
}

function setLocalMasteredWords(words: MasteredWord[]) {
  localStorage.setItem(MASTERED_KEY, JSON.stringify(words));
}

interface StreakCache {
  currentStreak: number;
  totalWords: number;
  todayWords: number;
  todayBlocks: number;
  lastActiveDate: string;
}

function getLocalStreak(): StreakCache {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
    return {
      currentStreak: s.currentStreak ?? 0,
      totalWords: s.totalWords ?? 0,
      todayWords: s.todayWords ?? 0,
      todayBlocks: s.todayBlocks ?? 0,
      lastActiveDate: s.lastActiveDate ?? '',
    };
  } catch {
    return { currentStreak: 0, totalWords: 0, todayWords: 0, todayBlocks: 0, lastActiveDate: '' };
  }
}

function setLocalStreak(s: StreakCache) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(s));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Hook ──

export function useLessonProgress(userId: string | null, lessonSlug: string | null) {
  const [blockState, setBlockState] = useState<Record<string, boolean>>({});
  const [masteredWords, setMasteredWords] = useState<MasteredWord[]>([]);
  const [streak, setStreak] = useState<StreakCache>(getLocalStreak());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load block state for current lesson
  useEffect(() => {
    if (!lessonSlug) return;
    const all = getLocalBlocks();
    setBlockState(all[lessonSlug] ?? {});
    setMasteredWords(getLocalMasteredWords());
    setStreak(getLocalStreak());

    // If authenticated, merge from DB
    if (userId) {
      supabase
        .from('learning_block_progress')
        .select('block_id, is_completed, attempts')
        .eq('user_id', userId)
        .eq('lesson_slug', lessonSlug)
        .then(({ data }) => {
          if (!data?.length) return;
          const all = getLocalBlocks();
          if (!all[lessonSlug]) all[lessonSlug] = {};
          for (const row of data) {
            if (row.is_completed) all[lessonSlug][row.block_id] = true;
          }
          setLocalBlocks(all);
          setBlockState({ ...all[lessonSlug] });
        });

      // Load streak from DB
      supabase
        .from('learning_daily_streaks')
        .select('activity_date, words_mastered, blocks_completed, streak_count')
        .eq('user_id', userId)
        .order('activity_date', { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (!data?.length) return;
          const latest = data[0];
          const totalWords = data.reduce((sum, d) => sum + (d.words_mastered || 0), 0);
          const s: StreakCache = {
            currentStreak: latest.streak_count || 0,
            totalWords,
            todayWords: latest.activity_date === todayStr() ? (latest.words_mastered || 0) : 0,
            todayBlocks: latest.activity_date === todayStr() ? (latest.blocks_completed || 0) : 0,
            lastActiveDate: latest.activity_date,
          };
          setLocalStreak(s);
          setStreak(s);
        });
    }
  }, [userId, lessonSlug]);

  // Toggle block completion
  const toggleBlock = useCallback((blockId: string) => {
    if (!lessonSlug) return;
    const all = getLocalBlocks();
    if (!all[lessonSlug]) all[lessonSlug] = {};
    const next = !all[lessonSlug][blockId];
    all[lessonSlug][blockId] = next;
    setLocalBlocks(all);
    setBlockState({ ...all[lessonSlug] });

    // Update streak
    if (next) {
      const s = getLocalStreak();
      const today = todayStr();
      if (s.lastActiveDate !== today) {
        // New day
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        s.currentStreak = s.lastActiveDate === yStr ? s.currentStreak + 1 : 1;
        s.todayWords = 0;
        s.todayBlocks = 0;
        s.lastActiveDate = today;
      }
      s.todayBlocks++;
      setLocalStreak(s);
      setStreak({ ...s });
    }

    // Debounced DB sync
    if (userId) {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        supabase.from('learning_block_progress').upsert({
          user_id: userId,
          lesson_slug: lessonSlug,
          block_id: blockId,
          is_completed: next,
          attempts: 1,
          completed_at: next ? new Date().toISOString() : null,
        }, { onConflict: 'user_id,lesson_slug,block_id' }).then(() => {});

        // Sync streak
        const s = getLocalStreak();
        supabase.from('learning_daily_streaks').upsert({
          user_id: userId,
          activity_date: todayStr(),
          words_mastered: s.todayWords,
          blocks_completed: s.todayBlocks,
          streak_count: s.currentStreak,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,activity_date' }).then(() => {});
      }, 1500);
    }
  }, [lessonSlug, userId]);

  // Add mastered word
  const addMasteredWord = useCallback((word: string, meaning: string, lesson: string) => {
    const words = getLocalMasteredWords();
    if (words.some(w => w.word === word)) return;
    const entry: MasteredWord = { word, meaning, lessonSlug: lesson, masteredAt: new Date().toISOString() };
    words.push(entry);
    setLocalMasteredWords(words);
    setMasteredWords([...words]);

    // Update streak
    const s = getLocalStreak();
    const today = todayStr();
    if (s.lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      s.currentStreak = s.lastActiveDate === yStr ? s.currentStreak + 1 : 1;
      s.todayWords = 0;
      s.todayBlocks = 0;
      s.lastActiveDate = today;
    }
    s.todayWords++;
    s.totalWords++;
    setLocalStreak(s);
    setStreak({ ...s });

    // DB sync
    if (userId) {
      supabase.from('learning_daily_streaks').upsert({
        user_id: userId,
        activity_date: today,
        words_mastered: s.todayWords,
        blocks_completed: s.todayBlocks,
        streak_count: s.currentStreak,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,activity_date' }).then(() => {});
    }
  }, [userId]);

  // Reset a specific section (for practice) — does NOT remove progress from DB/streak
  const resetSection = useCallback((lessonSlugToReset: string) => {
    const all = getLocalBlocks();
    if (all[lessonSlugToReset]) {
      all[lessonSlugToReset] = {};
      setLocalBlocks(all);
      if (lessonSlugToReset === lessonSlug) {
        setBlockState({});
      }
    }
  }, [lessonSlug]);

  return {
    blockState,
    toggleBlock,
    masteredWords,
    addMasteredWord,
    streak,
    resetSection,
    masteredWordsCount: masteredWords.length,
  };
}
