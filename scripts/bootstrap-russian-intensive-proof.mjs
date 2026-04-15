import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lessons = JSON.parse(fs.readFileSync(path.join(root, 'supabase/seed/russian/04_lessons_shared_core.json'), 'utf8'));
const modules = JSON.parse(fs.readFileSync(path.join(root, 'supabase/seed/russian/03_modules_shared_core.json'), 'utf8'));

const week = Number(process.argv[2] || '19');
const validWeek = Number.isFinite(week) && week >= 1 && week <= 20 ? week : 19;
const currentLessonNumber = ((validWeek - 1) * 6) + 1;
const lastLesson = lessons[lessons.length - 1];

const progressPayload = {
  completedLessons: lessons.map((lesson) => lesson.slug),
  currentLesson: lastLesson?.slug ?? null,
  currentModule: modules[modules.length - 1]?.slug ?? null,
  lastVisitedAt: new Date().toISOString(),
  learningStartedAt: new Date().toISOString(),
};

const onboardingPayload = {
  goal: 'prep_exam',
  timeline: '1_month',
  dailyMinutes: 60,
  academicTrack: 'shared_foundation',
};

const proofOverridePayload = {
  enabled: true,
  currentWeek: validWeek,
  currentLessonNumber,
  createdAt: new Date().toISOString(),
};

console.log('Browser console bootstrap for intensive proof:');
console.log(`localStorage.setItem('languages_russian_onboarding', ${JSON.stringify(JSON.stringify(onboardingPayload))});`);
console.log(`localStorage.setItem('languages_russian_progress', ${JSON.stringify(JSON.stringify(progressPayload))});`);
console.log(`localStorage.setItem('russian_intensive_750_proof_override', ${JSON.stringify(JSON.stringify(proofOverridePayload))});`);
console.log("window.location.href = '/languages/russian/dashboard?tab=exams';");
