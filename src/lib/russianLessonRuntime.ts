export type RussianLessonBlockType =
  | 'text_explanation'
  | 'vocab_list'
  | 'audio_player'
  | 'pronunciation_drill'
  | 'letter_sound_map'
  | 'copywriting_drill'
  | 'multiple_choice'
  | 'fill_in_blank'
  | 'matching'
  | 'ordering'
  | 'reading_task'
  | 'speaking_task'
  | 'task_scenario'
  | 'recycle_review'
  | 'image_figure'
  | 'teacher_prompt'
  | 'mini_quiz'
  | 'homework_assignment';

export interface RussianVocabItem {
  term: string;
  translation: string;
  priority: 'core' | 'high' | 'medium';
  reviewBucket: 'new' | 'active' | 'recycle' | 'mastered';
  notes?: string;
}

interface BaseBlock<T extends RussianLessonBlockType, P> {
  id: string;
  type: T;
  title: string;
  required: boolean;
  payload: P;
}

export type RussianLessonBlock =
  | BaseBlock<'text_explanation', { paragraphs: string[] }>
  | BaseBlock<'vocab_list', { items: RussianVocabItem[] }>
  | BaseBlock<'audio_player', {
    transcript: string;
    audioLabel: string;
    assetId?: string;
    src?: string;
    durationSeconds?: number;
    caption?: string;
    fallbackText?: string;
  }>
  | BaseBlock<'pronunciation_drill', { prompt: string; targetPhrases: string[] }>
  | BaseBlock<'letter_sound_map', { mappings: Array<{ grapheme: string; sound: string; example: string }> }>
  | BaseBlock<'copywriting_drill', { instructions: string; lines: string[] }>
  | BaseBlock<'multiple_choice', { prompt: string; options: Array<{ id: string; label: string; isCorrect: boolean }> }>
  | BaseBlock<'fill_in_blank', { prompt: string; sentence: string; answers: string[] }>
  | BaseBlock<'matching', { prompt: string; pairs: Array<{ left: string; right: string }> }>
  | BaseBlock<'ordering', { prompt: string; tokens: string[]; correctOrder: string[] }>
  | BaseBlock<'reading_task', { prompt: string; passage: string; questions: string[] }>
  | BaseBlock<'speaking_task', { prompt: string; cues: string[] }>
  | BaseBlock<'task_scenario', { scenario: string; task: string; successCriteria: string[] }>
  | BaseBlock<'recycle_review', { focus: string; recycledItems: RussianVocabItem[]; action: string }>
  | BaseBlock<'image_figure', {
    assetId?: string;
    src?: string;
    alt: string;
    caption?: string;
    fallbackText?: string;
  }>
  | BaseBlock<'teacher_prompt', { prompt: string; coachingTips: string[] }>
  | BaseBlock<'mini_quiz', { items: Array<{ question: string; answer: string }> }>
  | BaseBlock<'homework_assignment', { task: string; submissionHint: string }>;

export interface RussianLessonRuntime {
  lessonKey: string;
  lessonSlug: string;
  identity: {
    canonicalSlug: string;
    mappingMode: 'canonical' | 'compatibility_remap';
    mappedConceptTitle: string;
    note?: string;
  };
  title: string;
  objective: string;
  lane: 'literacy' | 'classroom_foundation';
  lessonMode: 'guided' | 'practice' | 'blended';
  readinessTarget: string;
  grammarFocus: string[];
  functionFocus: string[];
  canDoOutcomes: string[];
  teacherNotes: string[];
  masteryRules: {
    minimumRequiredBlocks: number;
    minimumQuizScore: number;
    mustCompleteBlockTypes: RussianLessonBlockType[];
  };
  orderedBlocks: RussianLessonBlock[];
  homeworkRefs: string[];
  checkpointLinks: string[];
  mockLinks: string[];
  vocabulary: RussianVocabItem[];
}

const buildLesson = (lesson: RussianLessonRuntime): RussianLessonRuntime => lesson;

export const PHASE_1A_LESSON_ORDER = [
  'alphabet-map',
  'sound-rules',
  'handwriting-decoding',
  'greetings',
  'self-introduction',
  'personal-information',
  'numbers-dates-time',
  'directions-places',
  'shopping-transport',
  'university-vocabulary',
] as const;

export const PHASE_1B_LESSON_ORDER = [
  'classroom-phrases',
  'instructions-questions',
  'reading-notices',
  'forms-labels',
  'short-academic-texts',
  'lecture-listening-cues',
  'note-taking-phrases',
  'short-written-responses',
  'noun-gender-number',
  'case-pattern-awareness',
] as const;

export const PHASE_1C_LESSON_ORDER = [
  'adjective-agreement-basics',
  'present-past-future',
  'motion-verbs-intro',
  'schedules-deadlines',
  'checkpoint-01-a',
  'checkpoint-01-b',
  'checkpoint-01-review',
  'checkpoint-02-a',
  'checkpoint-02-b',
  'checkpoint-02-review',
] as const;

export const russianPhase1ALessons: Record<string, RussianLessonRuntime> = {
  'alphabet-map': buildLesson({
    lessonKey: 'alphabet_map',
    lessonSlug: 'alphabet-map',
    identity: { canonicalSlug: 'alphabet-map', mappingMode: 'canonical', mappedConceptTitle: 'alphabet-map' },
    title: 'The Complete Russian Alphabet',
    objective: 'Learn all 33 Cyrillic letters: 10 vowels, 21 consonants, and 2 signs — with pronunciation for each.',
    lane: 'literacy',
    lessonMode: 'guided',
    readinessTarget: 'Recognize every letter of the Russian alphabet and produce its basic sound.',
    grammarFocus: ['letter-to-sound consistency', 'voiced/unvoiced pairs', 'false friends'],
    functionFocus: ['alphabet mastery', 'phonetic decoding'],
    canDoOutcomes: ['Can name and pronounce all 33 Russian letters.', 'Can identify false friends (letters that look Latin but sound different).', 'Can read simple syllables combining vowels and consonants.'],
    teacherNotes: ['Start with the full alphabet overview, then drill by groups.', 'Emphasize false friends early — В=/v/, Н=/n/, Р=/r/.', 'Use listen-repeat-read cycle for each letter group.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['letter_sound_map', 'mini_quiz', 'homework_assignment'] },
    checkpointLinks: [],
    mockLinks: [],
    homeworkRefs: ['hw-alphabet-1'],
    vocabulary: [
      { term: 'буква', translation: 'letter', priority: 'core', reviewBucket: 'new' },
      { term: 'звук', translation: 'sound', priority: 'core', reviewBucket: 'new' },
      { term: 'слог', translation: 'syllable', priority: 'high', reviewBucket: 'new' },
      { term: 'гласная', translation: 'vowel', priority: 'high', reviewBucket: 'new' },
      { term: 'согласная', translation: 'consonant', priority: 'high', reviewBucket: 'new' },
      { term: 'алфавит', translation: 'alphabet', priority: 'core', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      // 0. Full interactive alphabet board with audio
      { id: 'a1-full-board', type: 'letter_sound_map', title: 'All 33 Russian Letters — Tap & Listen', required: true, payload: { mappings: [
        { grapheme: 'А а', sound: '/a/', example: 'мáма (mama)' },
        { grapheme: 'Б б', sound: '/b/', example: 'банк (bank)' },
        { grapheme: 'В в', sound: '/v/', example: 'вот (here)' },
        { grapheme: 'Г г', sound: '/g/', example: 'год (year)' },
        { grapheme: 'Д д', sound: '/d/', example: 'дом (house)' },
        { grapheme: 'Е е', sound: '/je/', example: 'нет (no)' },
        { grapheme: 'Ё ё', sound: '/jo/', example: 'ёж (hedgehog)' },
        { grapheme: 'Ж ж', sound: '/ʒ/', example: 'жить (to live)' },
        { grapheme: 'З з', sound: '/z/', example: 'зал (hall)' },
        { grapheme: 'И и', sound: '/i/', example: 'мир (world)' },
        { grapheme: 'Й й', sound: '/j/', example: 'мой (my)' },
        { grapheme: 'К к', sound: '/k/', example: 'кот (cat)' },
        { grapheme: 'Л л', sound: '/l/', example: 'лук (onion)' },
        { grapheme: 'М м', sound: '/m/', example: 'мáма (mama)' },
        { grapheme: 'Н н', sound: '/n/', example: 'нос (nose)' },
        { grapheme: 'О о', sound: '/o/', example: 'окно (window)' },
        { grapheme: 'П п', sound: '/p/', example: 'папа (papa)' },
        { grapheme: 'Р р', sound: '/r/', example: 'рот (mouth)' },
        { grapheme: 'С с', sound: '/s/', example: 'сон (sleep)' },
        { grapheme: 'Т т', sound: '/t/', example: 'там (there)' },
        { grapheme: 'У у', sound: '/u/', example: 'тут (here)' },
        { grapheme: 'Ф ф', sound: '/f/', example: 'факт (fact)' },
        { grapheme: 'Х х', sound: '/x/', example: 'хлеб (bread)' },
        { grapheme: 'Ц ц', sound: '/ts/', example: 'центр (center)' },
        { grapheme: 'Ч ч', sound: '/tʃ/', example: 'час (hour)' },
        { grapheme: 'Ш ш', sound: '/ʃ/', example: 'школа (school)' },
        { grapheme: 'Щ щ', sound: '/ɕː/', example: 'щит (shield)' },
        { grapheme: 'Ъ ъ', sound: '—', example: 'объект (object)' },
        { grapheme: 'Ы ы', sound: '/ɨ/', example: 'мы (we)' },
        { grapheme: 'Ь ь', sound: '—', example: 'день (day)' },
        { grapheme: 'Э э', sound: '/e/', example: 'это (this)' },
        { grapheme: 'Ю ю', sound: '/ju/', example: 'юг (south)' },
        { grapheme: 'Я я', sound: '/ja/', example: 'яблоко (apple)' },
      ] } },

      // 1. Overview
      { id: 'a1-intro', type: 'text_explanation', title: 'Welcome to the Russian Alphabet', required: true, payload: { paragraphs: [
        'The Russian alphabet has 33 letters: 10 vowels, 21 consonants, and 2 special signs.',
        'Some letters look like Latin but sound completely different — these are called "false friends." For example: В looks like B but sounds /v/, Н looks like H but sounds /n/, and Р looks like P but sounds /r/.',
        'We will learn every letter today, group by group. Listen → Repeat → Read.',
      ] } },

      // 2. Vowel identification quiz
      { id: 'a1-vowel-mc1', type: 'multiple_choice', title: 'Which is a vowel?', required: true, payload: { prompt: 'Which of these is a Russian vowel?', options: [
        { id: '1', label: 'Б', isCorrect: false },
        { id: '2', label: 'О', isCorrect: true },
        { id: '3', label: 'Ш', isCorrect: false },
        { id: '4', label: 'Н', isCorrect: false },
      ] } },

      { id: 'a1-vowel-mc2', type: 'multiple_choice', title: 'Count the vowels', required: true, payload: { prompt: 'How many vowels are in the Russian alphabet?', options: [
        { id: '1', label: '5', isCorrect: false },
        { id: '2', label: '8', isCorrect: false },
        { id: '3', label: '10', isCorrect: true },
        { id: '4', label: '12', isCorrect: false },
      ] } },

      // 3. Consonants - voiced/unvoiced pairs
      { id: 'a1-cons-pairs', type: 'letter_sound_map', title: 'Consonant Pairs (Voiced ↔ Unvoiced)', required: true, payload: { mappings: [
        { grapheme: 'Б б / П п', sound: '/b/ ↔ /p/', example: 'банк / папа' },
        { grapheme: 'В в / Ф ф', sound: '/v/ ↔ /f/', example: 'вот / факт' },
        { grapheme: 'Г г / К к', sound: '/g/ ↔ /k/', example: 'год / кот' },
        { grapheme: 'Д д / Т т', sound: '/d/ ↔ /t/', example: 'дом / там' },
        { grapheme: 'З з / С с', sound: '/z/ ↔ /s/', example: 'зал / сон' },
        { grapheme: 'Ж ж / Ш ш', sound: '/ʒ/ ↔ /ʃ/', example: 'жить / школа' },
      ] } },

      // 4. Consonant pair quiz
      { id: 'a1-pair-mc', type: 'multiple_choice', title: 'Find the voiced pair', required: true, payload: { prompt: 'Which letter is the voiced pair of П?', options: [
        { id: '1', label: 'Ф', isCorrect: false },
        { id: '2', label: 'Б', isCorrect: true },
        { id: '3', label: 'В', isCorrect: false },
      ] } },

      // 5. Unpaired consonants
      { id: 'a1-cons-unpaired', type: 'letter_sound_map', title: 'Unpaired Consonants', required: true, payload: { mappings: [
        { grapheme: 'М м', sound: '/m/', example: 'мáма' },
        { grapheme: 'Н н', sound: '/n/', example: 'нет' },
        { grapheme: 'Л л', sound: '/l/', example: 'лук' },
        { grapheme: 'Р р', sound: '/r/', example: 'рот' },
        { grapheme: 'Й й', sound: '/j/', example: 'мой' },
        { grapheme: 'Х х', sound: '/x/', example: 'хлеб' },
        { grapheme: 'Ц ц', sound: '/ts/', example: 'центр' },
        { grapheme: 'Ч ч', sound: '/tʃ/', example: 'час' },
        { grapheme: 'Щ щ', sound: '/ɕː/', example: 'щит' },
      ] } },

      // 6. Signs explanation
      { id: 'a1-signs', type: 'text_explanation', title: 'The 2 Special Signs', required: true, payload: { paragraphs: [
        'Ъ (hard sign) — separates a consonant from a following vowel. It has no sound of its own. Example: объект.',
        'Ь (soft sign) — softens the preceding consonant. It also has no sound. Example: день (day).',
        'These signs modify pronunciation but are never pronounced alone.',
      ] } },

      // 7. Signs quiz
      { id: 'a1-signs-mc', type: 'multiple_choice', title: 'What does Ь do?', required: true, payload: { prompt: 'What is the function of Ь (soft sign)?', options: [
        { id: '1', label: 'It separates consonant from vowel', isCorrect: false },
        { id: '2', label: 'It softens the preceding consonant', isCorrect: true },
        { id: '3', label: 'It is a vowel', isCorrect: false },
      ] } },

      // 8. False friends drill
      { id: 'a1-false-friends', type: 'matching', title: 'False Friends: Match the REAL sound', required: true, payload: { prompt: 'These letters look like Latin but sound different! Match each to its Russian sound.', pairs: [
        { left: 'В (looks like B)', right: '/v/' },
        { left: 'Н (looks like H)', right: '/n/' },
        { left: 'Р (looks like P)', right: '/r/' },
        { left: 'С (looks like C)', right: '/s/' },
        { left: 'У (looks like Y)', right: '/u/' },
        { left: 'Х (looks like X)', right: '/x/' },
      ] } },

      // 9. False friends multiple choice
      { id: 'a1-ff-mc1', type: 'multiple_choice', title: 'What sound is В?', required: true, payload: { prompt: 'The Russian letter В (looks like B) actually sounds like...', options: [
        { id: '1', label: '/b/', isCorrect: false },
        { id: '2', label: '/v/', isCorrect: true },
        { id: '3', label: '/d/', isCorrect: false },
      ] } },

      { id: 'a1-ff-mc2', type: 'multiple_choice', title: 'What sound is Р?', required: true, payload: { prompt: 'The Russian letter Р (looks like P) actually sounds like...', options: [
        { id: '1', label: '/p/', isCorrect: false },
        { id: '2', label: '/r/', isCorrect: true },
        { id: '3', label: '/n/', isCorrect: false },
      ] } },

      // 10. Build your first words
      { id: 'a1-build-mama', type: 'ordering', title: 'Build: МАМА', required: true, payload: { prompt: 'Put letters in the correct order to spell МАМА (mama).', tokens: ['М', 'А', 'М', 'А'], correctOrder: ['М', 'А', 'М', 'А'] } },

      { id: 'a1-build-dom', type: 'ordering', title: 'Build: ДОМ', required: true, payload: { prompt: 'Put letters in the correct order to spell ДОМ (house).', tokens: ['О', 'Д', 'М'], correctOrder: ['Д', 'О', 'М'] } },

      { id: 'a1-build-kot', type: 'ordering', title: 'Build: КОТ', required: true, payload: { prompt: 'Put letters in the correct order to spell КОТ (cat).', tokens: ['Т', 'К', 'О'], correctOrder: ['К', 'О', 'Т'] } },

      // 11. Fill in missing letters
      { id: 'a1-fill1', type: 'fill_in_blank', title: 'Complete the word', required: true, payload: { prompt: 'Fill in the missing letter.', sentence: 'Д_М (house)', answers: ['О'] } },

      { id: 'a1-fill2', type: 'fill_in_blank', title: 'Complete the word', required: true, payload: { prompt: 'Fill in the missing letter.', sentence: 'К_Т (cat)', answers: ['О'] } },

      { id: 'a1-fill3', type: 'fill_in_blank', title: 'Complete the word', required: true, payload: { prompt: 'Fill in the missing letter.', sentence: 'Н_С (nose)', answers: ['О'] } },

      // 12. Syllable reading practice
      { id: 'a1-syllables', type: 'pronunciation_drill', title: 'Read syllables aloud', required: true, payload: { prompt: 'Combine consonants with vowels. Read each syllable clearly.', targetPhrases: ['ма-мо-му', 'ба-бо-бу', 'та-то-ту', 'да-до-ду', 'на-но-ну', 'ла-ло-лу', 'ра-ро-ру'] } },

      // 13. Word reading
      { id: 'a1-read', type: 'reading_task', title: 'Read your first Russian words', required: true, payload: { prompt: 'Read each word slowly, then at natural speed.', passage: 'мáма, дом, нет, тут, мир, банк, кот, рот, сон, час', questions: ['Which word means "house"?', 'Which word means "cat"?', 'Which letter in "рот" looks like P but sounds /r/?'] } },

      // 14. Word meaning matching
      { id: 'a1-word-match', type: 'matching', title: 'Match words to meanings', required: true, payload: { prompt: 'Connect each Russian word to its English meaning.', pairs: [
        { left: 'дом', right: 'house' },
        { left: 'кот', right: 'cat' },
        { left: 'мир', right: 'world' },
        { left: 'нос', right: 'nose' },
        { left: 'сон', right: 'sleep' },
      ] } },

      // 15. Final quiz
      { id: 'a1-quiz', type: 'mini_quiz', title: 'Alphabet Check', required: true, payload: { items: [
        { question: 'How many letters are in the Russian alphabet?', answer: '33' },
        { question: 'What sound does В represent?', answer: '/v/ (not /b/)' },
        { question: 'What sound does Н represent?', answer: '/n/ (not /h/)' },
        { question: 'What is the difference between Ъ and Ь?', answer: 'Ъ = hard sign (separator), Ь = soft sign (softens consonant)' },
        { question: 'Read aloud: кот', answer: 'кот (kot) — cat' },
      ] } },

      // 16. Homework
      { id: 'a1-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write all 33 letters from memory, then record yourself reading the 10 vowels and 10 simple words aloud.', submissionHint: 'Submit: 1) written alphabet page, 2) voice recording (30-60 seconds).' } },
    ],
  }),
  'sound-rules': buildLesson({
    lessonKey: 'sound_rules', lessonSlug: 'sound-rules',
    identity: { canonicalSlug: 'sound-rules', mappingMode: 'canonical', mappedConceptTitle: 'sound-rules' }, title: 'Alphabet II', objective: 'Expand decoding to consonant contrasts and soft/hard cues.', lane: 'literacy', lessonMode: 'guided', readinessTarget: 'Read 2-syllable high-frequency words accurately.',
    grammarFocus: ['soft sign awareness'], functionFocus: ['decoding'], canDoOutcomes: ['Can decode new consonant pairs in simple words.'], teacherNotes: ['Keep pace brisk: hear->point->read.', 'Use correction chain: stop, isolate, blend.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['letter_sound_map', 'multiple_choice', 'homework_assignment'] }, homeworkRefs: ['hw-alphabet-2'], checkpointLinks: [], mockLinks: [],
    vocabulary: [{ term: 'твёрдый', translation: 'hard', priority: 'medium', reviewBucket: 'new' }, { term: 'мягкий', translation: 'soft', priority: 'high', reviewBucket: 'new' }],
    orderedBlocks: [
      // 0. Visual reference image
      { id: 'a2-img', type: 'image_figure', title: 'Voiced vs Unvoiced Consonants', required: false, payload: {
        assetId: 'ru.sound_rules.voiced_unvoiced.v1',
        alt: 'Russian consonant pairs chart.',
        caption: 'Voiced consonants on left, unvoiced on right.',
      } },

      // 1. Letter review with expanded mappings
      { id: 'a2-map', type: 'letter_sound_map', title: 'Consonant Contrasts: Voiced vs Unvoiced', required: true, payload: { mappings: [
        { grapheme: 'Б б', sound: '/b/', example: 'банк (bank)' },
        { grapheme: 'П п', sound: '/p/', example: 'папа (papa)' },
        { grapheme: 'Д д', sound: '/d/', example: 'дом (house)' },
        { grapheme: 'Т т', sound: '/t/', example: 'там (there)' },
        { grapheme: 'Г г', sound: '/g/', example: 'год (year)' },
        { grapheme: 'К к', sound: '/k/', example: 'кот (cat)' },
      ] } },

      { id: 'a2-exp', type: 'text_explanation', title: 'Hard and Soft Consonants', required: true, payload: { paragraphs: [
        'Russian consonants can be hard or soft. The soft sign Ь after a consonant makes it soft.',
        'Compare: мат (mat) vs мать (mother) — the Ь changes the final consonant.',
        'Vowels also signal hardness/softness: А, О, У, Э, Ы → hard; Я, Ё, Ю, Е, И → soft.',
      ] } },

      // 2. Minimal pair listening — now uses OpenAI TTS via pronunciation_drill
      { id: 'a2-listen', type: 'pronunciation_drill', title: 'Listen & Repeat: Minimal Pairs', required: true, payload: {
        prompt: 'Tap each pair to hear the difference between voiced and unvoiced consonants. Then repeat aloud.',
        targetPhrases: ['ба — па', 'бо — по', 'да — та', 'до — то', 'га — ка', 'го — ко'],
      } },

      // 3. Multiple choice quizzes
      { id: 'a2-mc1', type: 'multiple_choice', title: 'Which letter matches /p/?', required: true, payload: { prompt: 'Which letter represents the sound /p/?', options: [
        { id: '1', label: 'Б', isCorrect: false },
        { id: '2', label: 'П', isCorrect: true },
        { id: '3', label: 'Д', isCorrect: false },
      ] } },

      { id: 'a2-mc2', type: 'multiple_choice', title: 'Voiced or unvoiced?', required: true, payload: { prompt: 'Is the letter Г voiced or unvoiced?', options: [
        { id: '1', label: 'Voiced', isCorrect: true },
        { id: '2', label: 'Unvoiced', isCorrect: false },
      ] } },

      { id: 'a2-mc3', type: 'multiple_choice', title: 'What makes a consonant soft?', required: true, payload: { prompt: 'What makes a Russian consonant soft?', options: [
        { id: '1', label: 'Ъ after it', isCorrect: false },
        { id: '2', label: 'Ь after it or soft vowel (Я, Е, Ё, Ю, И)', isCorrect: true },
        { id: '3', label: 'Nothing — all consonants are hard', isCorrect: false },
      ] } },

      // 4. Word building
      { id: 'a2-order1', type: 'ordering', title: 'Build: ПАПА', required: true, payload: { prompt: 'Put letters in order to spell ПАПА (papa).', tokens: ['П', 'А', 'П', 'А'], correctOrder: ['П', 'А', 'П', 'А'] } },

      { id: 'a2-order2', type: 'ordering', title: 'Build: БАНК', required: true, payload: { prompt: 'Put letters in order to spell БАНК (bank).', tokens: ['Н', 'Б', 'К', 'А'], correctOrder: ['Б', 'А', 'Н', 'К'] } },

      { id: 'a2-order3', type: 'ordering', title: 'Build: ДЕНЬ', required: true, payload: { prompt: 'Put letters in order to spell ДЕНЬ (day).', tokens: ['Н', 'Д', 'Ь', 'Е'], correctOrder: ['Д', 'Е', 'Н', 'Ь'] } },

      // 5. Fill in the blank
      { id: 'a2-fill1', type: 'fill_in_blank', title: 'Complete: hard or soft?', required: true, payload: { prompt: 'Fill the missing sign to make "mother".', sentence: 'мат_ (mother)', answers: ['ь'] } },

      { id: 'a2-fill2', type: 'fill_in_blank', title: 'Complete the word', required: true, payload: { prompt: 'Fill the missing letter.', sentence: '_ом (house)', answers: ['Д'] } },

      // 6. Matching pairs
      { id: 'a2-match', type: 'matching', title: 'Match voiced to unvoiced', required: true, payload: { prompt: 'Connect each voiced consonant to its unvoiced pair.', pairs: [
        { left: 'Б', right: 'П' },
        { left: 'Д', right: 'Т' },
        { left: 'Г', right: 'К' },
        { left: 'З', right: 'С' },
      ] } },

      // 7. Pronunciation with TTS
      { id: 'a2-pron', type: 'pronunciation_drill', title: 'Read minimal pairs', required: true, payload: { prompt: 'Read each pair clearly, emphasizing the difference.', targetPhrases: ['бал — пал', 'дом — том', 'год — кот', 'зал — сал'] } },

      // 8. Quiz
      { id: 'a2-quiz', type: 'mini_quiz', title: 'Exit quiz', required: true, payload: { items: [
        { question: 'What is the unvoiced pair of Б?', answer: 'П' },
        { question: 'What makes the consonant in "день" soft?', answer: 'The soft sign Ь after Н' },
        { question: 'Name 3 vowels that signal a soft consonant.', answer: 'Я, Е, И (also Ё, Ю)' },
      ] } },

      { id: 'a2-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Read 15 minimal pairs aloud and mark 3 that were difficult.', submissionHint: 'Bring marked list for teacher correction.' } },
    ],
  }),
  'handwriting-decoding': buildLesson({ lessonKey: 'handwriting_decoding', lessonSlug: 'handwriting-decoding',
    identity: { canonicalSlug: 'handwriting-decoding', mappingMode: 'canonical', mappedConceptTitle: 'handwriting-decoding' }, title: 'Stress and Pronunciation', objective: 'Notice stress and reduce unstressed vowels in simple words.', lane: 'literacy', lessonMode: 'blended', readinessTarget: 'Pronounce common words with intelligible stress.', grammarFocus: ['word stress'], functionFocus: ['pronunciation control'], canDoOutcomes: ['Can mark and pronounce stress in high-frequency words.'], teacherNotes: ['Clap stress physically.', 'Do not over-explain phonology terms.'], masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['pronunciation_drill', 'fill_in_blank', 'homework_assignment'] }, homeworkRefs: ['hw-stress'], checkpointLinks: [], mockLinks: [], vocabulary: [{ term: 'ударение', translation: 'stress', priority: 'core', reviewBucket: 'new' }, { term: 'молоко', translation: 'milk', priority: 'high', reviewBucket: 'new' }, { term: 'комната', translation: 'room', priority: 'high', reviewBucket: 'new' }], orderedBlocks: [
    { id: 's1-img', type: 'image_figure', title: 'Vowel Reduction', required: false, payload: {
      assetId: 'ru.stress.vowel_reduction.v1',
      alt: 'How unstressed О sounds like А.',
      caption: 'Vowel reduction: unstressed О → /a/.',
    } },

    { id: 's1-exp', type: 'text_explanation', title: 'Stress rule basics', required: true, payload: { paragraphs: [
      'Russian stress is unpredictable — it can fall on any syllable and changes how vowels sound.',
      'Stressed О sounds like /o/, but unstressed О sounds like /a/. Example: молокó → the first two О sound like "a".',
      'Mark stress with an acute accent (´) while practicing. This is the most important skill for natural pronunciation.',
    ] } },

    { id: 's1-pron', type: 'pronunciation_drill', title: 'Stress practice', required: true, payload: { prompt: 'Say each word twice — first slowly, then at natural speed. Focus on the stressed syllable.', targetPhrases: ['молокó', 'окнó', 'кóмната', 'студéнт', 'спасíбо'] } },

    { id: 's1-mc1', type: 'multiple_choice', title: 'Where is the stress?', required: true, payload: { prompt: 'In the word "молокó" (milk), which syllable is stressed?', options: [
      { id: '1', label: 'First (МО-)', isCorrect: false },
      { id: '2', label: 'Second (-ЛО-)', isCorrect: false },
      { id: '3', label: 'Third (-КО)', isCorrect: true },
    ] } },

    { id: 's1-mc2', type: 'multiple_choice', title: 'Unstressed О', required: true, payload: { prompt: 'How does unstressed О sound in Russian?', options: [
      { id: '1', label: 'Like /o/ (same as stressed)', isCorrect: false },
      { id: '2', label: 'Like /a/ (reduced)', isCorrect: true },
      { id: '3', label: 'It is silent', isCorrect: false },
    ] } },

    { id: 's1-mc3', type: 'multiple_choice', title: 'Find the stressed syllable', required: true, payload: { prompt: 'In "кóмната" (room), which syllable is stressed?', options: [
      { id: '1', label: 'First (КОМ-)', isCorrect: true },
      { id: '2', label: 'Second (-НА-)', isCorrect: false },
      { id: '3', label: 'Third (-ТА)', isCorrect: false },
    ] } },

    { id: 's1-match', type: 'matching', title: 'Match word to stress pattern', required: true, payload: { prompt: 'Match each word to its stress pattern (● = stressed, ○ = unstressed).', pairs: [
      { left: 'молокó', right: '○ ○ ●' },
      { left: 'кóмната', right: '● ○ ○' },
      { left: 'окнó', right: '○ ●' },
      { left: 'студéнт', right: '○ ●' },
    ] } },

    { id: 's1-order1', type: 'ordering', title: 'Build: МОЛОКО', required: true, payload: { prompt: 'Put syllables in order to spell молоко (milk).', tokens: ['ко', 'мо', 'ло'], correctOrder: ['мо', 'ло', 'ко'] } },

    { id: 's1-order2', type: 'ordering', title: 'Build: КОМНАТА', required: true, payload: { prompt: 'Put syllables in order to spell комната (room).', tokens: ['та', 'ком', 'на'], correctOrder: ['ком', 'на', 'та'] } },

    { id: 's1-fill1', type: 'fill_in_blank', title: 'Complete the word', required: true, payload: { prompt: 'Fill in the missing vowel.', sentence: 'м_локо (milk)', answers: ['о'] } },

    { id: 's1-fill2', type: 'fill_in_blank', title: 'Complete the word', required: true, payload: { prompt: 'Fill in the missing vowel.', sentence: 'студ_нт (student)', answers: ['е'] } },

    { id: 's1-pron2', type: 'pronunciation_drill', title: 'Common words with stress', required: true, payload: { prompt: 'Read these everyday words with correct stress placement.', targetPhrases: ['дóброе ýтро', 'спасíбо', 'пожáлуйста', 'извинíте', 'хорошó'] } },

    { id: 's1-quiz', type: 'mini_quiz', title: 'Stress quiz', required: true, payload: { items: [
      { question: 'Does Russian stress always fall on the same syllable?', answer: 'No — stress can fall on any syllable and must be memorized.' },
      { question: 'What happens to О when it is not stressed?', answer: 'It sounds like /a/ (vowel reduction).' },
      { question: 'Mark the stress: спасибо', answer: 'спасíбо (stress on second syllable)' },
    ] } },

    { id: 's1-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Mark stress on 20 common words and practice reading them aloud.', submissionHint: 'Color-code stressed syllables and record yourself.' } },
  ]}),
  'greetings': buildLesson({ lessonKey: 'greetings', lessonSlug: 'greetings',
    identity: { canonicalSlug: 'greetings', mappingMode: 'canonical', mappedConceptTitle: 'greetings' }, title: 'Greetings', objective: 'Use common Russian greetings in formal and informal contexts.', lane: 'literacy', lessonMode: 'guided', readinessTarget: 'Deliver greeting exchanges clearly.', grammarFocus: ['register choice'], functionFocus: ['greeting exchange'], canDoOutcomes: ['Can greet formally and informally.', 'Can respond to greetings appropriately.'], teacherNotes: ['Emphasize formal vs informal register.', 'Use board dictation with slow pace.'], masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['multiple_choice', 'matching', 'homework_assignment'] }, homeworkRefs: ['hw-greetings'], checkpointLinks: [], mockLinks: [],
    vocabulary: [{ term: 'Здравствуйте', translation: 'Hello (formal)', priority: 'core', reviewBucket: 'new' }, { term: 'Привет', translation: 'Hi (informal)', priority: 'core', reviewBucket: 'new' }, { term: 'Доброе утро', translation: 'Good morning', priority: 'high', reviewBucket: 'new' }, { term: 'До свидания', translation: 'Goodbye (formal)', priority: 'core', reviewBucket: 'new' }, { term: 'Пока', translation: 'Bye (informal)', priority: 'high', reviewBucket: 'new' }],
    orderedBlocks: [
    { id: 'gr-exp', type: 'text_explanation', title: 'Formal vs Informal Greetings', required: true, payload: { paragraphs: [
      'Russian has two levels of formality in greetings — formal (for teachers, strangers, elders) and informal (for friends).',
      'Formal: Здравствуйте! (Hello!) — used with people you address as "Вы" (you-formal).',
      'Informal: Привет! (Hi!) — used with friends and people your age.',
      'Time-based greetings: Доброе утро (Good morning), Добрый день (Good afternoon), Добрый вечер (Good evening).',
    ] } },

    { id: 'gr-vocab', type: 'vocab_list', title: 'Essential Greeting Phrases', required: true, payload: { items: [
      { term: 'Здравствуйте', translation: 'Hello (formal)', priority: 'core', reviewBucket: 'new' },
      { term: 'Привет', translation: 'Hi (informal)', priority: 'core', reviewBucket: 'new' },
      { term: 'Доброе утро', translation: 'Good morning', priority: 'high', reviewBucket: 'new' },
      { term: 'Добрый день', translation: 'Good afternoon', priority: 'high', reviewBucket: 'new' },
      { term: 'До свидания', translation: 'Goodbye (formal)', priority: 'core', reviewBucket: 'new' },
      { term: 'Пока', translation: 'Bye (informal)', priority: 'high', reviewBucket: 'new' },
      { term: 'Как дела?', translation: 'How are you?', priority: 'core', reviewBucket: 'new' },
      { term: 'Хорошо, спасибо', translation: 'Fine, thanks', priority: 'core', reviewBucket: 'new' },
    ] } },

    { id: 'gr-pron', type: 'pronunciation_drill', title: 'Practice greetings aloud', required: true, payload: { prompt: 'Listen and repeat each greeting clearly.', targetPhrases: ['Здравствуйте', 'Привет', 'Доброе утро', 'Добрый день', 'До свидания', 'Пока'] } },

    { id: 'gr-mc1', type: 'multiple_choice', title: 'Formal or informal?', required: true, payload: { prompt: 'You meet your professor. Which greeting do you use?', options: [
      { id: '1', label: 'Привет!', isCorrect: false },
      { id: '2', label: 'Здравствуйте!', isCorrect: true },
      { id: '3', label: 'Пока!', isCorrect: false },
    ] } },

    { id: 'gr-mc2', type: 'multiple_choice', title: 'Choose the right greeting', required: true, payload: { prompt: 'It is 9 AM. Which time-based greeting fits?', options: [
      { id: '1', label: 'Добрый вечер', isCorrect: false },
      { id: '2', label: 'Доброе утро', isCorrect: true },
      { id: '3', label: 'Добрый день', isCorrect: false },
    ] } },

    { id: 'gr-mc3', type: 'multiple_choice', title: 'How to say goodbye?', required: true, payload: { prompt: 'You are leaving a friend. Which word do you use?', options: [
      { id: '1', label: 'До свидания', isCorrect: false },
      { id: '2', label: 'Здравствуйте', isCorrect: false },
      { id: '3', label: 'Пока', isCorrect: true },
    ] } },

    { id: 'gr-match', type: 'matching', title: 'Match greeting to meaning', required: true, payload: { prompt: 'Connect each Russian greeting to its English meaning.', pairs: [
      { left: 'Здравствуйте', right: 'Hello (formal)' },
      { left: 'Привет', right: 'Hi (informal)' },
      { left: 'До свидания', right: 'Goodbye (formal)' },
      { left: 'Пока', right: 'Bye (informal)' },
      { left: 'Как дела?', right: 'How are you?' },
    ] } },

    { id: 'gr-order1', type: 'ordering', title: 'Build a greeting dialogue', required: true, payload: { prompt: 'Put this dialogue in correct order.', tokens: ['Хорошо, спасибо.', 'Здравствуйте!', 'Как дела?'], correctOrder: ['Здравствуйте!', 'Как дела?', 'Хорошо, спасибо.'] } },

    { id: 'gr-order2', type: 'ordering', title: 'Build: ПРИВЕТ', required: true, payload: { prompt: 'Put letters in order to spell ПРИВЕТ (hi).', tokens: ['В', 'П', 'Е', 'Р', 'И', 'Т'], correctOrder: ['П', 'Р', 'И', 'В', 'Е', 'Т'] } },

    { id: 'gr-fill1', type: 'fill_in_blank', title: 'Complete the phrase', required: true, payload: { prompt: 'Complete this formal goodbye.', sentence: 'До _______.', answers: ['свидания'] } },

    { id: 'gr-fill2', type: 'fill_in_blank', title: 'Complete the response', required: true, payload: { prompt: 'Answer "How are you?"', sentence: '_______, спасибо.', answers: ['Хорошо'] } },

    { id: 'gr-speak', type: 'speaking_task', title: 'Greeting roleplay', required: true, payload: { prompt: 'Practice a short greeting exchange.', cues: ['Здравствуйте! Как дела?', 'Хорошо, спасибо. А вы?', 'Тоже хорошо. До свидания!'] } },

    { id: 'gr-quiz', type: 'mini_quiz', title: 'Greetings quiz', required: true, payload: { items: [
      { question: 'What is the formal greeting?', answer: 'Здравствуйте' },
      { question: 'What is the informal goodbye?', answer: 'Пока' },
      { question: 'How do you ask "How are you?"', answer: 'Как дела?' },
    ] } },

    { id: 'gr-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write 3 short greeting dialogues: one formal, one informal, one time-based.', submissionHint: 'Record yourself reading one dialogue aloud.' } },
  ]}),
  'self-introduction': buildLesson({ lessonKey: 'self_introduction', lessonSlug: 'self-introduction',
    identity: { canonicalSlug: 'self-introduction', mappingMode: 'canonical', mappedConceptTitle: 'self-introduction' }, title: 'Self-Introduction', objective: 'Introduce yourself with name, origin, and role.', lane: 'literacy', lessonMode: 'practice', readinessTarget: 'Produce a 20-second self-introduction.', grammarFocus: ['Меня зовут construction', 'Я из + country'], functionFocus: ['self-introduction'], canDoOutcomes: ['Can introduce self in 3 sentences.', 'Can ask someone their name.'], teacherNotes: ['Monitor finger-tracking; remove it gradually.'], masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['ordering', 'mini_quiz', 'homework_assignment'] }, homeworkRefs: ['hw-intro'], checkpointLinks: [], mockLinks: [],
    vocabulary: [{ term: 'Меня зовут', translation: 'My name is', priority: 'core', reviewBucket: 'new' }, { term: 'Я из', translation: 'I am from', priority: 'core', reviewBucket: 'new' }, { term: 'Я студент', translation: 'I am a student (m)', priority: 'core', reviewBucket: 'new' }, { term: 'Я студентка', translation: 'I am a student (f)', priority: 'core', reviewBucket: 'new' }, { term: 'Как вас зовут?', translation: 'What is your name?', priority: 'core', reviewBucket: 'new' }],
    orderedBlocks: [
    { id: 'si-exp', type: 'text_explanation', title: 'How to introduce yourself', required: true, payload: { paragraphs: [
      'A Russian self-introduction follows a simple pattern: Name → Origin → Role.',
      'Меня зовут... (My name is...) — this is the standard way to state your name.',
      'Я из... (I am from...) — add your country or city.',
      'Я студент (male) / Я студентка (female) — state your role.',
      'To ask someone\'s name: Как вас зовут? (formal) or Как тебя зовут? (informal).',
    ] } },

    { id: 'si-vocab', type: 'vocab_list', title: 'Self-introduction phrases', required: true, payload: { items: [
      { term: 'Меня зовут…', translation: 'My name is…', priority: 'core', reviewBucket: 'new' },
      { term: 'Как вас зовут?', translation: 'What is your name? (formal)', priority: 'core', reviewBucket: 'new' },
      { term: 'Я из…', translation: 'I am from…', priority: 'core', reviewBucket: 'new' },
      { term: 'Я студент', translation: 'I am a student (m)', priority: 'core', reviewBucket: 'new' },
      { term: 'Я студентка', translation: 'I am a student (f)', priority: 'core', reviewBucket: 'new' },
      { term: 'Очень приятно', translation: 'Nice to meet you', priority: 'high', reviewBucket: 'new' },
      { term: 'Мне … лет', translation: 'I am … years old', priority: 'high', reviewBucket: 'new' },
    ] } },

    { id: 'si-pron', type: 'pronunciation_drill', title: 'Practice introduction phrases', required: true, payload: { prompt: 'Listen and repeat each phrase.', targetPhrases: ['Меня зовут Анна', 'Я из Турции', 'Я студентка', 'Очень приятно', 'Как вас зовут?'] } },

    { id: 'si-mc1', type: 'multiple_choice', title: 'How do you say your name?', required: true, payload: { prompt: 'Which phrase means "My name is..."?', options: [
      { id: '1', label: 'Как вас зовут?', isCorrect: false },
      { id: '2', label: 'Меня зовут…', isCorrect: true },
      { id: '3', label: 'Я из…', isCorrect: false },
    ] } },

    { id: 'si-mc2', type: 'multiple_choice', title: 'Male or female form?', required: true, payload: { prompt: 'A female student says:', options: [
      { id: '1', label: 'Я студент', isCorrect: false },
      { id: '2', label: 'Я студентка', isCorrect: true },
    ] } },

    { id: 'si-mc3', type: 'multiple_choice', title: 'Ask someone\'s name', required: true, payload: { prompt: 'How do you formally ask someone their name?', options: [
      { id: '1', label: 'Как тебя зовут?', isCorrect: false },
      { id: '2', label: 'Меня зовут…', isCorrect: false },
      { id: '3', label: 'Как вас зовут?', isCorrect: true },
    ] } },

    { id: 'si-match', type: 'matching', title: 'Match phrases to meanings', required: true, payload: { prompt: 'Connect each phrase to its meaning.', pairs: [
      { left: 'Меня зовут…', right: 'My name is…' },
      { left: 'Я из…', right: 'I am from…' },
      { left: 'Очень приятно', right: 'Nice to meet you' },
      { left: 'Как вас зовут?', right: 'What is your name?' },
    ] } },

    { id: 'si-order1', type: 'ordering', title: 'Build an introduction', required: true, payload: { prompt: 'Put this introduction in correct order.', tokens: ['Я студентка.', 'Меня зовут Анна.', 'Я из Индии.'], correctOrder: ['Меня зовут Анна.', 'Я из Индии.', 'Я студентка.'] } },

    { id: 'si-order2', type: 'ordering', title: 'Build a dialogue', required: true, payload: { prompt: 'Order this meeting dialogue.', tokens: ['Очень приятно!', 'Как вас зовут?', 'Меня зовут Али.', 'Здравствуйте!'], correctOrder: ['Здравствуйте!', 'Как вас зовут?', 'Меня зовут Али.', 'Очень приятно!'] } },

    { id: 'si-fill1', type: 'fill_in_blank', title: 'Complete the introduction', required: true, payload: { prompt: 'Fill in the blank.', sentence: '______ зовут Ахмед.', answers: ['Меня'] } },

    { id: 'si-fill2', type: 'fill_in_blank', title: 'Complete the phrase', required: true, payload: { prompt: 'Fill in the blank.', sentence: 'Я ___ Турции.', answers: ['из'] } },

    { id: 'si-speak', type: 'speaking_task', title: 'Introduce yourself', required: true, payload: { prompt: 'Give a full self-introduction in Russian (3-4 sentences).', cues: ['Здравствуйте!', 'Меня зовут...', 'Я из...', 'Я студент/студентка.'] } },

    { id: 'si-quiz', type: 'mini_quiz', title: 'Self-introduction quiz', required: true, payload: { items: [
      { question: 'How do you say "My name is..." in Russian?', answer: 'Меня зовут…' },
      { question: 'What is the female form of "student"?', answer: 'студентка' },
      { question: 'How do you say "I am from Turkey"?', answer: 'Я из Турции' },
    ] } },

    { id: 'si-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write and record a 30-second self-introduction in Russian.', submissionHint: 'Include: greeting, name, origin, role. Record audio.' } },
  ]}),
  'personal-information': buildLesson({ lessonKey: 'personal_information', lessonSlug: 'personal-information',
    identity: { canonicalSlug: 'personal-information', mappingMode: 'canonical', mappedConceptTitle: 'personal-information' }, title: 'Personal Information', objective: 'State key personal information: name, age, country, and study focus.', lane: 'classroom_foundation', lessonMode: 'blended', readinessTarget: 'Introduce self in 20–30 seconds.', grammarFocus: ['formal/informal you'], functionFocus: ['introductions'], canDoOutcomes: ['Can share name, age, and origin in class.'], teacherNotes: ['Force turn-taking with strict time box.'], masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['speaking_task', 'mini_quiz', 'homework_assignment'] }, homeworkRefs: ['hw-intro'], checkpointLinks: [], mockLinks: [], vocabulary: [{ term: 'Здравствуйте', translation: 'Hello (formal)', priority: 'core', reviewBucket: 'new' }, { term: 'Меня зовут…', translation: 'My name is…', priority: 'core', reviewBucket: 'new' }, { term: 'Я из…', translation: 'I am from…', priority: 'high', reviewBucket: 'new' }], orderedBlocks: [
    { id: 'gi-vocab', type: 'vocab_list', title: 'Target phrases', required: true, payload: { items: [{ term: 'Здравствуйте', translation: 'Hello (formal)', priority: 'core', reviewBucket: 'new' }, { term: 'Меня зовут…', translation: 'My name is…', priority: 'core', reviewBucket: 'new' }, { term: 'Очень приятно', translation: 'Nice to meet you', priority: 'high', reviewBucket: 'new' }] } },
    { id: 'gi-figure', type: 'image_figure', title: 'Introduction dialogue board', required: false, payload: {
      assetId: 'ru.personal_info.dialogue_board.v1',
      alt: 'Dialogue board for greeting, name, age, and origin.',
      caption: 'Use as a scaffold before speaking rounds.',
    } },
    { id: 'gi-audio', type: 'pronunciation_drill', title: 'Listen & Repeat: Dialogue', required: true, payload: {
      prompt: 'Tap each phrase to hear it, then repeat aloud.',
      targetPhrases: ['Здравствуйте!', 'Меня зовут Анна.', 'Я из Индии.'],
    } },
    { id: 'gi-speak', type: 'speaking_task', title: 'Self-introduction drill', required: true, payload: { prompt: 'Introduce yourself in three sentences.', cues: ['Greeting', 'Name', 'Origin'] } },
    { id: 'gi-mcq', type: 'multiple_choice', title: 'Phrase selection', required: true, payload: { prompt: 'Choose the formal greeting.', options: [{ id: '1', label: 'Привет', isCorrect: false }, { id: '2', label: 'Здравствуйте', isCorrect: true }] } },
    { id: 'gi-teacher', type: 'teacher_prompt', title: 'Teacher prompt', required: false, payload: { prompt: 'Swap partners every 90 seconds and track fluency errors.', coachingTips: ['One correction only per round', 'Prioritize intelligibility'] } },
    { id: 'gi-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Record a 30-second introduction + write transcript.', submissionHint: 'Highlight greeting and self-identification lines.' } },
  ]}),
  'numbers-dates-time': buildLesson({ lessonKey: 'numbers_dates_time', lessonSlug: 'numbers-dates-time',
    identity: { canonicalSlug: 'numbers-dates-time', mappingMode: 'canonical', mappedConceptTitle: 'numbers-dates-time' }, title: 'Numbers, Age, Dates, Time', objective: 'State age, date, and time in common classroom contexts.', lane: 'classroom_foundation', lessonMode: 'blended', readinessTarget: 'Answer date/time prompts without transliteration.', grammarFocus: ['cardinal numbers'], functionFocus: ['asking and telling time'], canDoOutcomes: ['Can state age, date, and class time.'], teacherNotes: ['Use board clocks and date cards.', 'Keep drills oral first then written.'], masteryRules: { minimumRequiredBlocks: 6, minimumQuizScore: 75, mustCompleteBlockTypes: ['fill_in_blank', 'mini_quiz', 'homework_assignment'] }, homeworkRefs: ['hw-numbers-time'], checkpointLinks: [], mockLinks: [], vocabulary: [{ term: 'сколько', translation: 'how many/how much', priority: 'core', reviewBucket: 'new' }, { term: 'лет', translation: 'years old', priority: 'core', reviewBucket: 'new' }, { term: 'час', translation: 'hour', priority: 'core', reviewBucket: 'new' }], orderedBlocks: [
    { id: 'ndt-exp', type: 'text_explanation', title: 'Number/date patterns', required: true, payload: { paragraphs: ['Ages use number + лет.', 'Clock time uses час/часа/часов patterns.'] } },
    { id: 'ndt-vocab', type: 'vocab_list', title: 'Core number language', required: true, payload: { items: [{ term: 'Сколько вам лет?', translation: 'How old are you?', priority: 'core', reviewBucket: 'new' }, { term: 'Сейчас три часа', translation: 'It is three o’clock now', priority: 'high', reviewBucket: 'new' }] } },
    { id: 'ndt-time-figure', type: 'image_figure', title: 'Date and time board', required: false, payload: {
      assetId: 'ru.numbers.time_board.v1',
      alt: 'Board showing Russian date and time examples.',
      caption: 'Use as a quick visual reference for age/date/time forms.',
    } },
    { id: 'ndt-listen', type: 'pronunciation_drill', title: 'Listen & Repeat: Numbers and Time', required: false, payload: {
      prompt: 'Tap each phrase to hear it, then repeat aloud.',
      targetPhrases: ['Мне восемнадцать лет.', 'Сейчас девять часов.', 'Двенадцатое марта.'],
    } },
    { id: 'ndt-fill', type: 'fill_in_blank', title: 'Fill number forms', required: true, payload: { prompt: 'Complete age expression.', sentence: 'Мне 18 ____.', answers: ['лет'] } },
    { id: 'ndt-match', type: 'matching', title: 'Match numeral to phrase', required: true, payload: { prompt: 'Connect number and phrase.', pairs: [{ left: '18', right: 'восемнадцать' }, { left: '09:00', right: 'девять часов' }] } },
    { id: 'ndt-quiz', type: 'mini_quiz', title: 'Mini quiz', required: true, payload: { items: [{ question: 'Say date: 12.03', answer: 'двенадцатое марта' }, { question: 'Say 7:30', answer: 'половина восьмого' }] } },
    { id: 'ndt-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write your weekly class schedule with dates and times in Russian.', submissionHint: 'Use at least 6 time expressions.' } },
  ]}),
  'directions-places': buildLesson({ lessonKey: 'directions_places', lessonSlug: 'directions-places',
    identity: { canonicalSlug: 'directions-places', mappingMode: 'canonical', mappedConceptTitle: 'directions-places' }, title: 'Directions and Places', objective: 'Ask and answer for location and directions inside campus settings.', lane: 'classroom_foundation', lessonMode: 'guided', readinessTarget: 'Understand object/location instructions in class.', grammarFocus: ['preposition basics в/на'], functionFocus: ['locating objects'], canDoOutcomes: ['Can describe location of classroom objects.'], teacherNotes: ['Use realia in classroom.', 'Enforce full sentence output.'], masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['vocab_list', 'matching', 'homework_assignment'] }, homeworkRefs: ['hw-objects-places'], checkpointLinks: [], mockLinks: [], vocabulary: [{ term: 'аудитория', translation: 'classroom', priority: 'core', reviewBucket: 'new' }, { term: 'доска', translation: 'board', priority: 'core', reviewBucket: 'new' }, { term: 'стол', translation: 'desk', priority: 'high', reviewBucket: 'new' }], orderedBlocks: [
    { id: 'cop-vocab', type: 'vocab_list', title: 'Objects and places', required: true, payload: { items: [{ term: 'доска', translation: 'board', priority: 'core', reviewBucket: 'new' }, { term: 'дверь', translation: 'door', priority: 'high', reviewBucket: 'new' }, { term: 'в аудитории', translation: 'in the classroom', priority: 'high', reviewBucket: 'new' }] } },
    { id: 'cop-read', type: 'reading_task', title: 'Classroom description', required: true, payload: { prompt: 'Read and answer.', passage: 'Книга на столе. Карта на доске. Студенты в аудитории.', questions: ['Where is the book?', 'Where are students?'] } },
    { id: 'cop-map-figure', type: 'image_figure', title: 'Classroom map', required: false, payload: {
      assetId: 'ru.directions.classroom_map.v1',
      alt: 'Classroom map used for location phrases.',
      caption: 'Match each phrase to a visible object location.',
    } },
    { id: 'cop-listen', type: 'pronunciation_drill', title: 'Listen & Repeat: Location Phrases', required: false, payload: {
      prompt: 'Tap each phrase to hear it, then repeat aloud.',
      targetPhrases: ['Книга на столе.', 'Карта на доске.', 'Студенты в аудитории.'],
    } },
    { id: 'cop-match', type: 'matching', title: 'Match object + location', required: true, payload: { prompt: 'Build correct pairs.', pairs: [{ left: 'карта', right: 'на доске' }, { left: 'журнал', right: 'на столе' }] } },
    { id: 'cop-speak', type: 'speaking_task', title: 'Describe your room', required: true, payload: { prompt: 'Name 4 objects and locations.', cues: ['на столе', 'в аудитории', 'у двери'] } },
    { id: 'cop-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Take one room photo and annotate 8 objects in Russian.', submissionHint: 'Use at least 3 location phrases.' } },
  ]}),
  'shopping-transport': buildLesson({ lessonKey: 'shopping_transport', lessonSlug: 'shopping-transport',
    identity: { canonicalSlug: 'shopping-transport', mappingMode: 'canonical', mappedConceptTitle: 'shopping-transport' }, title: 'Shopping and Transport', objective: 'Use practical Russian for buying essentials and public transport routines.', lane: 'classroom_foundation', lessonMode: 'practice', readinessTarget: 'Follow one-step classroom commands immediately.', grammarFocus: ['imperative basics'], functionFocus: ['classroom command response'], canDoOutcomes: ['Can respond to simple teacher commands.'], teacherNotes: ['Train TPR-style response first.', 'Correct command parsing before pronunciation.'], masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['multiple_choice', 'speaking_task', 'homework_assignment'] }, homeworkRefs: ['hw-commands-1'], checkpointLinks: [], mockLinks: [], vocabulary: [{ term: 'Откройте', translation: 'Open (formal/plural)', priority: 'core', reviewBucket: 'new' }, { term: 'Повторите', translation: 'Repeat', priority: 'core', reviewBucket: 'new' }], orderedBlocks: [
    { id: 'cc1-exp', type: 'text_explanation', title: 'Command form', required: true, payload: { paragraphs: ['Formal class commands often use -йте forms.', 'Respond with action + short confirmation.'] } },
    { id: 'cc1-figure', type: 'image_figure', title: 'Shopping and transport phrase board', required: false, payload: {
      assetId: 'ru.shopping_transport.phrase_board.v1',
      alt: 'Phrase board for shopping and transport roleplay contexts.',
      caption: 'Use during transactional phrase drills.',
    } },
    { id: 'cc1-listen', type: 'pronunciation_drill', title: 'Listen & Repeat: Commands', required: true, payload: {
      prompt: 'Tap each command to hear it, then respond aloud.',
      targetPhrases: ['Откройте книгу.', 'Повторите.', 'Напишите ответ.'],
    } },
    { id: 'cc1-mc', type: 'multiple_choice', title: 'Command meaning', required: true, payload: { prompt: 'Откройте тетрадь means...', options: [{ id: '1', label: 'Close the notebook', isCorrect: false }, { id: '2', label: 'Open the notebook', isCorrect: true }] } },
    { id: 'cc1-speak', type: 'speaking_task', title: 'Respond aloud', required: true, payload: { prompt: 'Answer as student after command.', cues: ['Да, открываю тетрадь.', 'Повторяю.'] } },
    { id: 'cc1-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Create 8 command-response flashcards.', submissionHint: 'Mark confusing commands for active review bucket.' } },
  ]}),
  'university-vocabulary': buildLesson({ lessonKey: 'university_vocabulary', lessonSlug: 'university-vocabulary',
    identity: { canonicalSlug: 'university-vocabulary', mappingMode: 'canonical', mappedConceptTitle: 'university-vocabulary' }, title: 'University Vocabulary', objective: 'Build essential vocabulary for classes, schedules, and campus communication.', lane: 'classroom_foundation', lessonMode: 'blended', readinessTarget: 'Execute chained instructions under normal class speed.', grammarFocus: ['sequencing with потом'], functionFocus: ['clarification requests'], canDoOutcomes: ['Can follow two-step class instructions.'], teacherNotes: ['Simulate lecture pace.', 'Reward clear clarification language.'], masteryRules: { minimumRequiredBlocks: 6, minimumQuizScore: 75, mustCompleteBlockTypes: ['ordering', 'mini_quiz', 'homework_assignment'] }, homeworkRefs: ['hw-commands-2'], checkpointLinks: ['shared_core_checkpoint_01_v1'], mockLinks: [], vocabulary: [{ term: 'Сначала', translation: 'First', priority: 'high', reviewBucket: 'new' }, { term: 'Потом', translation: 'Then', priority: 'high', reviewBucket: 'new' }, { term: 'Повторите, пожалуйста', translation: 'Repeat, please', priority: 'core', reviewBucket: 'new' }], orderedBlocks: [
    { id: 'cc2-exp', type: 'text_explanation', title: 'Two-step commands', required: true, payload: { paragraphs: ['Listen for sequence markers сначала/потом.', 'Use clarification phrase immediately when unsure.'] } },
    { id: 'cc2-reference-figure', type: 'image_figure', title: 'Classroom location reference', required: false, payload: {
      assetId: 'ru.directions.classroom_map.v1',
      alt: 'Campus-classroom reference visual for chained commands.',
      caption: 'Optional visual scaffold during sequencing drills.',
    } },
    { id: 'cc2-vocab-figure', type: 'image_figure', title: 'University vocabulary board', required: false, payload: {
      assetId: 'ru.university.vocabulary_board.v1',
      alt: 'Vocabulary board for core university and classroom language.',
      caption: 'Supports rapid vocabulary recognition in sequencing tasks.',
    } },
    { id: 'cc2-listen', type: 'pronunciation_drill', title: 'Listen & Repeat: University Phrases', required: false, payload: {
      prompt: 'Tap each phrase to hear it, then repeat aloud.',
      targetPhrases: ['Аудитория.', 'Библиотека.', 'Лаборатория.', 'Сначала читайте, потом пишите.', 'Повторите, пожалуйста.'],
    } },
    { id: 'cc2-order', type: 'ordering', title: 'Sequence commands', required: true, payload: { prompt: 'Order the instruction parts.', tokens: ['Откройте текст', 'потом', 'ответьте на вопрос'], correctOrder: ['Откройте текст', 'потом', 'ответьте на вопрос'] } },
    { id: 'cc2-fill', type: 'fill_in_blank', title: 'Clarification phrase', required: true, payload: { prompt: 'Complete polite request.', sentence: '_______, пожалуйста.', answers: ['Повторите'] } },
    { id: 'cc2-speak', type: 'speaking_task', title: 'Command response roleplay', required: true, payload: { prompt: 'Teacher gives 3 commands; respond each with action sentence.', cues: ['Сначала читайте, потом пишите.', 'Повторите, пожалуйста.'] } },
    { id: 'cc2-teacher', type: 'teacher_prompt', title: 'Teacher prompt', required: false, payload: { prompt: 'Run 4-minute speed command loop and tag comprehension breaks.', coachingTips: ['Track lag >3s', 'Prompt self-repair before correction'] } },
    { id: 'cc2-quiz', type: 'mini_quiz', title: 'Mastery check', required: true, payload: { items: [{ question: 'Translate: Сначала читайте, потом пишите.', answer: 'First read, then write.' }] } },
    { id: 'cc2-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write 10 chained commands + record 5 spoken responses.', submissionHint: 'Include at least 2 clarification requests.' } },
  ]}),
  'classroom-phrases': buildLesson({
    lessonKey: 'classroom_phrases',
    lessonSlug: 'classroom-phrases',
    identity: { canonicalSlug: 'classroom-phrases', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Pronouns and Basic Identity', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Pronouns and Basic Identity',
    objective: 'Use basic pronouns and identity sentences in classroom introductions.',
    lane: 'classroom_foundation',
    lessonMode: 'guided',
    readinessTarget: 'Build first-person and third-person identity statements.',
    grammarFocus: ['personal pronouns'],
    functionFocus: ['basic identity'],
    canDoOutcomes: ['Can introduce self with pronouns.', 'Can identify another person using он/она.'],
    teacherNotes: ['Model pronouns with gestures.', 'Require full sentence response.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['task_scenario', 'mini_quiz', 'homework_assignment'] },
    homeworkRefs: ['hw-pronouns-identity'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'я', translation: 'I', priority: 'core', reviewBucket: 'new' },
      { term: 'он', translation: 'he', priority: 'high', reviewBucket: 'new' },
      { term: 'она', translation: 'she', priority: 'high', reviewBucket: 'new' },
      { term: 'студент', translation: 'student', priority: 'core', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'pbi-vocab', type: 'vocab_list', title: 'Identity pronouns', required: true, payload: { items: [{ term: 'я', translation: 'I', priority: 'core', reviewBucket: 'new' }, { term: 'мы', translation: 'we', priority: 'high', reviewBucket: 'new' }, { term: 'студент', translation: 'student', priority: 'core', reviewBucket: 'active' }] } },
      { id: 'pbi-scenario', type: 'task_scenario', title: 'Scenario: first day in class', required: true, payload: { scenario: 'You meet two classmates and introduce yourself.', task: 'Say who you are and identify one classmate.', successCriteria: ['Uses я + role', 'Uses он/она correctly'] } },
      { id: 'pbi-mc', type: 'multiple_choice', title: 'Pronoun selection', required: true, payload: { prompt: 'Анна — ____ студентка.', options: [{ id: '1', label: 'она', isCorrect: true }, { id: '2', label: 'он', isCorrect: false }] } },
      { id: 'pbi-recycle', type: 'recycle_review', title: 'Recycle from greetings', required: false, payload: { focus: 'Reuse greeting + identity from prior lessons', recycledItems: [{ term: 'Здравствуйте', translation: 'Hello (formal)', priority: 'core', reviewBucket: 'recycle' }], action: 'Open each identity sentence with a greeting.' } },
      { id: 'pbi-quiz', type: 'mini_quiz', title: 'Can-do check', required: true, payload: { items: [{ question: 'Say: I am a student.', answer: 'Я студент/Я студентка.' }] } },
      { id: 'pbi-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write 8 identity lines with different pronouns.', submissionHint: 'Mark recycled vocabulary in a different color.' } },
    ],
  }),
  'instructions-questions': buildLesson({
    lessonKey: 'instructions_questions',
    lessonSlug: 'instructions-questions',
    identity: { canonicalSlug: 'instructions-questions', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Gender and Singular/Plural', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Gender and Singular/Plural',
    objective: 'Recognize gender and singular/plural forms for basic nouns.',
    lane: 'classroom_foundation',
    lessonMode: 'guided',
    readinessTarget: 'Use noun endings to infer gender and number.',
    grammarFocus: ['noun gender', 'singular/plural'],
    functionFocus: ['agreement awareness'],
    canDoOutcomes: ['Can identify masculine/feminine noun endings.', 'Can switch simple nouns from singular to plural.'],
    teacherNotes: ['Keep examples concrete and visual.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['matching', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-gender-plural'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'книга', translation: 'book', priority: 'core', reviewBucket: 'recycle' },
      { term: 'книги', translation: 'books', priority: 'high', reviewBucket: 'new' },
      { term: 'стол', translation: 'desk', priority: 'high', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'gsp-exp', type: 'text_explanation', title: 'Gender + number cues', required: true, payload: { paragraphs: ['Many feminine nouns end in -а/-я.', 'Plural often changes ending and stress.'] } },
      { id: 'gsp-match', type: 'matching', title: 'Match singular and plural', required: true, payload: { prompt: 'Connect each singular noun to plural.', pairs: [{ left: 'книга', right: 'книги' }, { left: 'студент', right: 'студенты' }] } },
      { id: 'gsp-scenario', type: 'task_scenario', title: 'Scenario: classroom inventory', required: true, payload: { scenario: 'Teacher asks how many objects are in class.', task: 'Answer using singular/plural correctly.', successCriteria: ['At least 3 nouns in plural', 'Correct gender article pattern awareness'] } },
      { id: 'gsp-fill', type: 'fill_in_blank', title: 'Plural ending drill', required: true, payload: { prompt: 'Complete plural form.', sentence: 'стол -> стол__', answers: ['ы'] } },
      { id: 'gsp-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Create a 12-word singular/plural list from your classroom.', submissionHint: 'Tag each word as m/f/n where possible.' } },
    ],
  }),
  'reading-notices': buildLesson({
    lessonKey: 'reading_notices',
    lessonSlug: 'reading-notices',
    identity: { canonicalSlug: 'reading-notices', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Basic Study Verbs', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Basic Study Verbs',
    objective: 'Use high-frequency study verbs in present tense classroom contexts.',
    lane: 'classroom_foundation',
    lessonMode: 'practice',
    readinessTarget: 'Produce action statements about studying tasks.',
    grammarFocus: ['present tense verb patterns'],
    functionFocus: ['study routine statements'],
    canDoOutcomes: ['Can say what they read/write/listen to in class.'],
    teacherNotes: ['Prioritize chunk practice over full conjugation tables.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['speaking_task', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-study-verbs'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'читать', translation: 'to read', priority: 'core', reviewBucket: 'new' },
      { term: 'писать', translation: 'to write', priority: 'core', reviewBucket: 'new' },
      { term: 'повторять', translation: 'to repeat/review', priority: 'high', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'sv-vocab', type: 'vocab_list', title: 'Study verbs', required: true, payload: { items: [{ term: 'читать', translation: 'to read', priority: 'core', reviewBucket: 'new' }, { term: 'писать', translation: 'to write', priority: 'core', reviewBucket: 'new' }] } },
      { id: 'sv-speak', type: 'speaking_task', title: 'Verb sentence drill', required: true, payload: { prompt: 'Say 4 lines about your study routine.', cues: ['Я читаю...', 'Я пишу...'] } },
      { id: 'sv-scenario', type: 'task_scenario', title: 'Scenario: teacher asks your routine', required: true, payload: { scenario: 'Teacher checks study habits before exam.', task: 'Answer with at least three study verbs.', successCriteria: ['At least 3 verbs used', 'Correct subject pronoun'] } },
      { id: 'sv-recycle', type: 'recycle_review', title: 'Recycle command language', required: false, payload: { focus: 'Convert commands into self-statements', recycledItems: [{ term: 'Повторите', translation: 'Repeat', priority: 'core', reviewBucket: 'recycle' }], action: 'Transform teacher command into first-person action.' } },
      { id: 'sv-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write and record a 6-line study routine.', submissionHint: 'Include one recycled word from prior lesson.' } },
    ],
  }),
  'forms-labels': buildLesson({
    lessonKey: 'forms_labels',
    lessonSlug: 'forms-labels',
    identity: { canonicalSlug: 'forms-labels', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Question Patterns', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Question Patterns',
    objective: 'Use basic question structures for classroom communication.',
    lane: 'classroom_foundation',
    lessonMode: 'guided',
    readinessTarget: 'Ask simple who/what/where/when questions.',
    grammarFocus: ['question words'],
    functionFocus: ['information requests'],
    canDoOutcomes: ['Can ask at least 4 classroom questions.'],
    teacherNotes: ['Require rising intonation in oral practice.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['task_scenario', 'mini_quiz', 'homework_assignment'] },
    homeworkRefs: ['hw-question-patterns'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'что', translation: 'what', priority: 'core', reviewBucket: 'new' },
      { term: 'где', translation: 'where', priority: 'core', reviewBucket: 'new' },
      { term: 'когда', translation: 'when', priority: 'high', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'qp-exp', type: 'text_explanation', title: 'Question stems', required: true, payload: { paragraphs: ['Place question word first for clarity.', 'Keep question short in early stage.'] } },
      { id: 'qp-order', type: 'ordering', title: 'Order the question', required: true, payload: { prompt: 'Arrange words into a valid question.', tokens: ['где', 'книга'], correctOrder: ['где', 'книга'] } },
      { id: 'qp-scenario', type: 'task_scenario', title: 'Scenario: ask the teacher', required: true, payload: { scenario: 'You cannot find your homework page.', task: 'Ask two clarification questions.', successCriteria: ['Uses at least 2 question words'] } },
      { id: 'qp-quiz', type: 'mini_quiz', title: 'Question can-do check', required: true, payload: { items: [{ question: 'Ask: Where is the board?', answer: 'Где доска?' }] } },
      { id: 'qp-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Prepare 10 classroom questions for partner drill.', submissionHint: 'Mark 3 as recycled from previous content.' } },
    ],
  }),
  'short-academic-texts': buildLesson({
    lessonKey: 'short_academic_texts',
    lessonSlug: 'short-academic-texts',
    identity: { canonicalSlug: 'short-academic-texts', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Schedule, Lesson, Homework', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Schedule, Lesson, Homework',
    objective: 'Discuss class schedule, lesson timing, and homework expectations.',
    lane: 'classroom_foundation',
    lessonMode: 'blended',
    readinessTarget: 'Understand and state schedule-related classroom information.',
    grammarFocus: ['time expressions'],
    functionFocus: ['planning and homework communication'],
    canDoOutcomes: ['Can state class schedule and homework due time.'],
    teacherNotes: ['Tie examples to real student timetable.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['reading_task', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-schedule-homework'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'расписание', translation: 'schedule', priority: 'core', reviewBucket: 'new' },
      { term: 'урок', translation: 'lesson', priority: 'core', reviewBucket: 'active' },
      { term: 'домашнее задание', translation: 'homework', priority: 'core', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'slh-read', type: 'reading_task', title: 'Read schedule notice', required: true, payload: { prompt: 'Read and extract class time + homework.', passage: 'Урок биологии в 10:00. Домашнее задание: страница 12.', questions: ['When is biology?', 'What is homework?'] } },
      { id: 'slh-fill', type: 'fill_in_blank', title: 'Due-time drill', required: true, payload: { prompt: 'Complete deadline sentence.', sentence: 'Домашнее задание до ____.', answers: ['пятницы'] } },
      { id: 'slh-scenario', type: 'task_scenario', title: 'Scenario: confirm homework deadline', required: true, payload: { scenario: 'You are unsure of due date.', task: 'Ask and confirm lesson + deadline details.', successCriteria: ['Mentions lesson', 'Mentions due date'] } },
      { id: 'slh-recycle', type: 'recycle_review', title: 'Recycle numbers/time', required: false, payload: { focus: 'Reuse date/time phrases', recycledItems: [{ term: 'час', translation: 'hour', priority: 'core', reviewBucket: 'recycle' }], action: 'State two class times using prior number patterns.' } },
      { id: 'slh-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write your weekly lesson and homework calendar in Russian.', submissionHint: 'Include 5 entries minimum.' } },
    ],
  }),
  'lecture-listening-cues': buildLesson({
    lessonKey: 'lecture_listening_cues',
    lessonSlug: 'lecture-listening-cues',
    identity: { canonicalSlug: 'lecture-listening-cues', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Asking for Help and Clarification', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Asking for Help and Clarification',
    objective: 'Ask for repetition, slower speech, and explanation politely.',
    lane: 'classroom_foundation',
    lessonMode: 'practice',
    readinessTarget: 'Use clarification language during instruction.',
    grammarFocus: ['polite imperative requests'],
    functionFocus: ['help-seeking'],
    canDoOutcomes: ['Can request repetition or explanation politely.'],
    teacherNotes: ['Reward spontaneous clarification requests.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['task_scenario', 'speaking_task', 'homework_assignment'] },
    homeworkRefs: ['hw-help-clarify'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'Помогите, пожалуйста', translation: 'Please help', priority: 'core', reviewBucket: 'new' },
      { term: 'Повторите, пожалуйста', translation: 'Repeat, please', priority: 'core', reviewBucket: 'recycle' },
      { term: 'Я не понимаю', translation: 'I do not understand', priority: 'core', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'ahc-listen', type: 'pronunciation_drill', title: 'Listen & Repeat: Clarification Phrases', required: true, payload: { prompt: 'Tap each phrase to hear it, then repeat aloud.', targetPhrases: ['Извините.', 'Повторите, пожалуйста.', 'Я не понимаю.'] } },
      { id: 'ahc-speak', type: 'speaking_task', title: 'Clarification phrase drill', required: true, payload: { prompt: 'Respond to unclear instruction with help request.', cues: ['Повторите, пожалуйста.', 'Можно медленнее?'] } },
      { id: 'ahc-scenario', type: 'task_scenario', title: 'Scenario: missed lecture point', required: true, payload: { scenario: 'Teacher gives fast instruction.', task: 'Request help and restate instruction correctly.', successCriteria: ['Polite request used', 'Instruction repeated back'] } },
      { id: 'ahc-quiz', type: 'mini_quiz', title: 'Help language check', required: true, payload: { items: [{ question: 'Say: I do not understand, please repeat.', answer: 'Я не понимаю, повторите, пожалуйста.' }] } },
      { id: 'ahc-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Record 5 clarification responses for common class issues.', submissionHint: 'Include at least one recycled phrase.' } },
    ],
  }),
  'note-taking-phrases': buildLesson({
    lessonKey: 'note_taking_phrases',
    lessonSlug: 'note-taking-phrases',
    identity: { canonicalSlug: 'note-taking-phrases', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Scientific Russian I: What is…?', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Scientific Russian I: What is…?',
    objective: 'Define simple scientific concepts using beginner Russian patterns.',
    lane: 'classroom_foundation',
    lessonMode: 'guided',
    readinessTarget: 'Answer “What is…?” for basic science terms.',
    grammarFocus: ['definition structure это ...'],
    functionFocus: ['scientific definition'],
    canDoOutcomes: ['Can answer “Что такое …?” with a short definition.'],
    teacherNotes: ['Keep definitions short and concrete.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['task_scenario', 'mini_quiz', 'homework_assignment'] },
    homeworkRefs: ['hw-science-what-is'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'что такое', translation: 'what is', priority: 'core', reviewBucket: 'new' },
      { term: 'вещество', translation: 'substance', priority: 'high', reviewBucket: 'new' },
      { term: 'клетка', translation: 'cell', priority: 'core', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'sr1-exp', type: 'text_explanation', title: 'Definition frame', required: true, payload: { paragraphs: ['Use pattern: X — это Y.', 'Start with high-frequency science nouns.'] } },
      { id: 'sr1-read', type: 'reading_task', title: 'Read simple definitions', required: true, payload: { prompt: 'Read and identify term + category.', passage: 'Клетка — это часть организма.', questions: ['What is being defined?'] } },
      { id: 'sr1-scenario', type: 'task_scenario', title: 'Scenario: science warm-up', required: true, payload: { scenario: 'Teacher asks: Что такое клетка?', task: 'Give one-sentence definition.', successCriteria: ['Uses это pattern', 'Meaning is accurate'] } },
      { id: 'sr1-quiz', type: 'mini_quiz', title: 'Definition check', required: true, payload: { items: [{ question: 'Define вещество simply.', answer: 'Вещество — это материал.' }] } },
      { id: 'sr1-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write 6 “Что такое…?” science cards with answers.', submissionHint: 'At least 2 cards must reuse prior vocabulary.' } },
    ],
  }),
  'short-written-responses': buildLesson({
    lessonKey: 'short_written_responses',
    lessonSlug: 'short-written-responses',
    identity: { canonicalSlug: 'short-written-responses', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Scientific Russian II: Classification', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Scientific Russian II: Classification',
    objective: 'Classify simple scientific terms into basic groups.',
    lane: 'classroom_foundation',
    lessonMode: 'blended',
    readinessTarget: 'Sort terms by category and explain why.',
    grammarFocus: ['classification phrases'],
    functionFocus: ['categorization'],
    canDoOutcomes: ['Can classify simple scientific terms into categories.'],
    teacherNotes: ['Use sorting cards before writing explanations.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['matching', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-science-classification'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'группа', translation: 'group/category', priority: 'high', reviewBucket: 'new' },
      { term: 'живой', translation: 'living', priority: 'core', reviewBucket: 'new' },
      { term: 'неживой', translation: 'non-living', priority: 'core', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'sr2-match', type: 'matching', title: 'Term-to-category matching', required: true, payload: { prompt: 'Match each term to category.', pairs: [{ left: 'клетка', right: 'живой' }, { left: 'камень', right: 'неживой' }] } },
      { id: 'sr2-scenario', type: 'task_scenario', title: 'Scenario: classify lab objects', required: true, payload: { scenario: 'You receive 6 lab terms to sort.', task: 'Classify each and justify one choice.', successCriteria: ['Correct category labels', 'One short justification'] } },
      { id: 'sr2-order', type: 'ordering', title: 'Build classification statement', required: true, payload: { prompt: 'Order words into a classification sentence.', tokens: ['Клетка', 'это', 'живая', 'структура'], correctOrder: ['Клетка', 'это', 'живая', 'структура'] } },
      { id: 'sr2-recycle', type: 'recycle_review', title: 'Recycle “what is” pattern', required: false, payload: { focus: 'Definition + category', recycledItems: [{ term: 'что такое', translation: 'what is', priority: 'core', reviewBucket: 'recycle' }], action: 'Define then classify two terms.' } },
      { id: 'sr2-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Classify 12 mixed words into three groups.', submissionHint: 'Mark which words came from previous lessons.' } },
    ],
  }),
  'noun-gender-number': buildLesson({
    lessonKey: 'noun_gender_number',
    lessonSlug: 'noun-gender-number',
    identity: { canonicalSlug: 'noun-gender-number', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Scientific Russian III: Process and Cause', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Scientific Russian III: Process and Cause',
    objective: 'Describe simple cause-and-process relationships in science contexts.',
    lane: 'classroom_foundation',
    lessonMode: 'blended',
    readinessTarget: 'Use simple cause connectors in science statements.',
    grammarFocus: ['потому что / поэтому'],
    functionFocus: ['process explanation'],
    canDoOutcomes: ['Can describe a simple process and a cause.'],
    teacherNotes: ['Use arrow diagrams while speaking.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['task_scenario', 'speaking_task', 'homework_assignment'] },
    homeworkRefs: ['hw-science-process-cause'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'процесс', translation: 'process', priority: 'core', reviewBucket: 'new' },
      { term: 'причина', translation: 'cause', priority: 'core', reviewBucket: 'new' },
      { term: 'поэтому', translation: 'therefore', priority: 'high', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'sr3-exp', type: 'text_explanation', title: 'Cause connectors', required: true, payload: { paragraphs: ['Use потому что for cause.', 'Use поэтому for result.'] } },
      { id: 'sr3-speak', type: 'speaking_task', title: 'Process narration drill', required: true, payload: { prompt: 'Describe a two-step process with cause/result.', cues: ['потому что...', 'поэтому...'] } },
      { id: 'sr3-scenario', type: 'task_scenario', title: 'Scenario: explain a simple experiment', required: true, payload: { scenario: 'Water is heated in class experiment.', task: 'Explain one cause and one result.', successCriteria: ['One cause phrase', 'One result phrase'] } },
      { id: 'sr3-quiz', type: 'mini_quiz', title: 'Cause-result check', required: true, payload: { items: [{ question: 'Complete: Температура высокая, ____ вода кипит.', answer: 'поэтому' }] } },
      { id: 'sr3-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write 5 cause-result lines for science topics.', submissionHint: 'Reuse at least 2 terms from prior scientific lessons.' } },
    ],
  }),
  'case-pattern-awareness': buildLesson({
    lessonKey: 'case_pattern_awareness',
    lessonSlug: 'case-pattern-awareness',
    identity: { canonicalSlug: 'case-pattern-awareness', mappingMode: 'compatibility_remap', mappedConceptTitle: 'Biology Russian I: Cell and Organism', note: 'Legacy canonical slug retained for compatibility with existing progression graph.' },
    title: 'Biology Russian I: Cell and Organism',
    objective: 'Describe cell and organism basics with beginner biology Russian.',
    lane: 'classroom_foundation',
    lessonMode: 'guided',
    readinessTarget: 'Name key cell and organism concepts in short statements.',
    grammarFocus: ['is/has beginner statements'],
    functionFocus: ['biology description'],
    canDoOutcomes: ['Can describe a cell as part of an organism.', 'Can name basic organism-related terms.'],
    teacherNotes: ['Focus on concept accuracy before grammar perfection.'],
    masteryRules: { minimumRequiredBlocks: 6, minimumQuizScore: 75, mustCompleteBlockTypes: ['reading_task', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-biology-cell-organism'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'клетка', translation: 'cell', priority: 'core', reviewBucket: 'recycle' },
      { term: 'организм', translation: 'organism', priority: 'core', reviewBucket: 'new' },
      { term: 'ткань', translation: 'tissue', priority: 'high', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'bio1-vocab', type: 'vocab_list', title: 'Biology core words', required: true, payload: { items: [{ term: 'клетка', translation: 'cell', priority: 'core', reviewBucket: 'recycle' }, { term: 'организм', translation: 'organism', priority: 'core', reviewBucket: 'new' }] } },
      { id: 'bio1-read', type: 'reading_task', title: 'Read beginner bio text', required: true, payload: { prompt: 'Read and answer.', passage: 'Клетка — часть организма. Ткань состоит из клеток.', questions: ['What is cell?', 'What forms tissue?'] } },
      { id: 'bio1-scenario', type: 'task_scenario', title: 'Scenario: explain to a classmate', required: true, payload: { scenario: 'A classmate asks what a cell is.', task: 'Give a two-sentence explanation.', successCriteria: ['Mentions organism', 'Uses at least one biology term'] } },
      { id: 'bio1-recycle', type: 'recycle_review', title: 'Recycle scientific definitions', required: false, payload: { focus: 'Reuse “что такое” + classification patterns', recycledItems: [{ term: 'что такое', translation: 'what is', priority: 'core', reviewBucket: 'recycle' }, { term: 'живой', translation: 'living', priority: 'core', reviewBucket: 'recycle' }], action: 'Define and classify two biology terms.' } },
      { id: 'bio1-quiz', type: 'mini_quiz', title: 'Biology can-do quiz', required: true, payload: { items: [{ question: 'Say: A cell is part of an organism.', answer: 'Клетка — часть организма.' }] } },
      { id: 'bio1-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Create a mini glossary: 10 biology words with one-line definitions.', submissionHint: 'Mark recycled vs new terms.' } },
    ],
  }),
  'adjective-agreement-basics': buildLesson({
    lessonKey: 'adjective_agreement_basics',
    lessonSlug: 'adjective-agreement-basics',
    identity: { canonicalSlug: 'adjective-agreement-basics', mappingMode: 'canonical', mappedConceptTitle: 'Adjective Agreement Basics' },
    title: 'Adjective Agreement Basics',
    objective: 'Use basic adjective-noun agreement in beginner academic phrases.',
    lane: 'classroom_foundation',
    lessonMode: 'guided',
    readinessTarget: 'Produce adjective+noun phrases with basic agreement awareness.',
    grammarFocus: ['adjective endings', 'gender-number agreement'],
    functionFocus: ['description'],
    canDoOutcomes: ['Can form simple adjective+noun phrases in singular/plural.'],
    teacherNotes: ['Prioritize phrase chunks over full paradigm memorization.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['task_scenario', 'mini_quiz', 'homework_assignment'] },
    homeworkRefs: ['hw-adjective-agreement'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'большой', translation: 'big', priority: 'core', reviewBucket: 'new' },
      { term: 'маленький', translation: 'small', priority: 'high', reviewBucket: 'new' },
      { term: 'важный', translation: 'important', priority: 'high', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'aa-exp', type: 'text_explanation', title: 'Agreement starter rules', required: true, payload: { paragraphs: ['Adjectives change with noun gender/number.', 'Use fixed phrase patterns first.'] } },
      { id: 'aa-match', type: 'matching', title: 'Match adjective+noun pairs', required: true, payload: { prompt: 'Build correct pairs.', pairs: [{ left: 'важный', right: 'вопрос' }, { left: 'важная', right: 'тема' }] } },
      { id: 'aa-scenario', type: 'task_scenario', title: 'Scenario: describe class materials', required: true, payload: { scenario: 'Teacher asks you to describe two objects.', task: 'Give 2 adjective+noun phrases.', successCriteria: ['Two correct phrases', 'At least one plural form'] } },
      { id: 'aa-recycle', type: 'recycle_review', title: 'Recycle classroom nouns', required: false, payload: { focus: 'Reuse prior nouns with new adjectives', recycledItems: [{ term: 'книга', translation: 'book', priority: 'core', reviewBucket: 'recycle' }, { term: 'урок', translation: 'lesson', priority: 'core', reviewBucket: 'recycle' }], action: 'Create 4 adjective+noun combinations.' } },
      { id: 'aa-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write 10 adjective+noun pairs from your current study context.', submissionHint: 'Mark which pairs are singular/plural.' } },
    ],
  }),
  'present-past-future': buildLesson({
    lessonKey: 'present_past_future',
    lessonSlug: 'present-past-future',
    identity: { canonicalSlug: 'present-past-future', mappingMode: 'canonical', mappedConceptTitle: 'Present, Past, Future' },
    title: 'Present, Past, Future',
    objective: 'Use simple time references to describe study actions.',
    lane: 'classroom_foundation',
    lessonMode: 'blended',
    readinessTarget: 'Describe what you study now, studied before, and will study next.',
    grammarFocus: ['tense timeline markers'],
    functionFocus: ['time framing'],
    canDoOutcomes: ['Can produce one sentence each for present, past, future.'],
    teacherNotes: ['Use timeline visuals for tense anchoring.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['speaking_task', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-present-past-future'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'сейчас', translation: 'now', priority: 'core', reviewBucket: 'new' },
      { term: 'вчера', translation: 'yesterday', priority: 'core', reviewBucket: 'new' },
      { term: 'завтра', translation: 'tomorrow', priority: 'core', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'ppf-vocab', type: 'vocab_list', title: 'Time anchors', required: true, payload: { items: [{ term: 'сейчас', translation: 'now', priority: 'core', reviewBucket: 'new' }, { term: 'вчера', translation: 'yesterday', priority: 'core', reviewBucket: 'new' }, { term: 'завтра', translation: 'tomorrow', priority: 'core', reviewBucket: 'new' }] } },
      { id: 'ppf-speak', type: 'speaking_task', title: 'Three-line tense drill', required: true, payload: { prompt: 'Say 3 lines (present/past/future).', cues: ['Сейчас я...', 'Вчера я...', 'Завтра я...'] } },
      { id: 'ppf-scenario', type: 'task_scenario', title: 'Scenario: teacher progress check', required: true, payload: { scenario: 'Teacher asks about your study timeline.', task: 'Respond with three tense-based lines.', successCriteria: ['All three time markers used'] } },
      { id: 'ppf-quiz', type: 'mini_quiz', title: 'Timeline check', required: true, payload: { items: [{ question: 'Complete: ____ я повторял лекцию.', answer: 'Вчера' }] } },
      { id: 'ppf-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write a 9-line study diary (3 present, 3 past, 3 future).', submissionHint: 'Include one recycled verb in each tense set.' } },
    ],
  }),
  'motion-verbs-intro': buildLesson({
    lessonKey: 'motion_verbs_intro',
    lessonSlug: 'motion-verbs-intro',
    identity: { canonicalSlug: 'motion-verbs-intro', mappingMode: 'canonical', mappedConceptTitle: 'Motion Verbs Intro' },
    title: 'Motion Verbs Intro',
    objective: 'Use beginner motion verbs for classroom and campus movement.',
    lane: 'classroom_foundation',
    lessonMode: 'guided',
    readinessTarget: 'Describe where you go/come in study contexts.',
    grammarFocus: ['идти/ехать basics'],
    functionFocus: ['movement statements'],
    canDoOutcomes: ['Can describe movement to/from class with basic verbs.'],
    teacherNotes: ['Drill direction pairs with gestures and maps.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['task_scenario', 'mini_quiz', 'homework_assignment'] },
    homeworkRefs: ['hw-motion-verbs'],
    checkpointLinks: [],
    mockLinks: [],
    vocabulary: [
      { term: 'идти', translation: 'to go (on foot)', priority: 'core', reviewBucket: 'new' },
      { term: 'ехать', translation: 'to go (by transport)', priority: 'core', reviewBucket: 'new' },
      { term: 'приходить', translation: 'to arrive', priority: 'high', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'mv-exp', type: 'text_explanation', title: 'Motion verb contrast', required: true, payload: { paragraphs: ['Use идти for walking movement.', 'Use ехать for transport movement.'] } },
      { id: 'mv-scenario', type: 'task_scenario', title: 'Scenario: route to class', required: true, payload: { scenario: 'Classmate asks how you get to campus.', task: 'Answer with one walking and one transport example.', successCriteria: ['Both motion verbs used'] } },
      { id: 'mv-match', type: 'matching', title: 'Verb-context matching', required: true, payload: { prompt: 'Match verb to situation.', pairs: [{ left: 'идти', right: 'to library on foot' }, { left: 'ехать', right: 'to university by bus' }] } },
      { id: 'mv-recycle', type: 'recycle_review', title: 'Recycle places vocabulary', required: false, payload: { focus: 'Combine motion verbs with known places', recycledItems: [{ term: 'аудитория', translation: 'classroom', priority: 'core', reviewBucket: 'recycle' }], action: 'Create 3 movement sentences to known places.' } },
      { id: 'mv-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write 8 movement sentences from your weekly routine.', submissionHint: 'Mark walking vs transport lines.' } },
    ],
  }),
  'schedules-deadlines': buildLesson({
    lessonKey: 'schedules_deadlines',
    lessonSlug: 'schedules-deadlines',
    identity: { canonicalSlug: 'schedules-deadlines', mappingMode: 'canonical', mappedConceptTitle: 'Schedules and Deadlines' },
    title: 'Schedules and Deadlines',
    objective: 'Communicate deadlines and schedule updates clearly.',
    lane: 'classroom_foundation',
    lessonMode: 'blended',
    readinessTarget: 'State task deadlines and timing conflicts.',
    grammarFocus: ['deadline phrases'],
    functionFocus: ['planning communication'],
    canDoOutcomes: ['Can state deadlines and ask for timing clarification.'],
    teacherNotes: ['Use real assignment context.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['task_scenario', 'mini_quiz', 'homework_assignment'] },
    homeworkRefs: ['hw-schedules-deadlines'],
    checkpointLinks: ['shared_core_checkpoint_01_v1'],
    mockLinks: [],
    vocabulary: [
      { term: 'срок', translation: 'deadline', priority: 'core', reviewBucket: 'new' },
      { term: 'до пятницы', translation: 'by Friday', priority: 'core', reviewBucket: 'new' },
      { term: 'опоздать', translation: 'to be late', priority: 'high', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'sd-read', type: 'reading_task', title: 'Deadline notice reading', required: true, payload: { prompt: 'Read and extract due date.', passage: 'Отчёт до пятницы, 18:00.', questions: ['What is the deadline?'] } },
      { id: 'sd-scenario', type: 'task_scenario', title: 'Scenario: negotiate deadline', required: true, payload: { scenario: 'You need clarification on assignment deadline.', task: 'Ask for due date and restate it.', successCriteria: ['Deadline question asked', 'Deadline repeated accurately'] } },
      { id: 'sd-fill', type: 'fill_in_blank', title: 'Deadline phrase drill', required: true, payload: { prompt: 'Complete phrase.', sentence: 'Задание ___ пятницы.', answers: ['до'] } },
      { id: 'sd-quiz', type: 'mini_quiz', title: 'Deadline can-do check', required: true, payload: { items: [{ question: 'Say: The deadline is by Friday.', answer: 'Срок до пятницы.' }] } },
      { id: 'sd-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Create a deadline board with 6 tasks and due dates.', submissionHint: 'Mark urgent items and recycled schedule words.' } },
    ],
  }),
  'checkpoint-01-a': buildLesson({
    lessonKey: 'checkpoint_01_a',
    lessonSlug: 'checkpoint-01-a',
    identity: { canonicalSlug: 'checkpoint-01-a', mappingMode: 'canonical', mappedConceptTitle: 'Checkpoint 01 A' },
    title: 'Checkpoint 01 A',
    objective: 'Mixed checkpoint on literacy and classroom foundations (guided mini-assessment).',
    lane: 'classroom_foundation',
    lessonMode: 'practice',
    readinessTarget: 'Demonstrate retention of Phase 1 foundations across mixed tasks.',
    grammarFocus: ['mixed review'],
    functionFocus: ['checkpoint performance'],
    canDoOutcomes: ['Can complete mixed recognition and production checkpoint tasks.'],
    teacherNotes: ['Use as low-stakes diagnostic; note patterns for remediation.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['mini_quiz', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-checkpoint-01-a'],
    checkpointLinks: ['shared_core_checkpoint_01_v1'],
    mockLinks: [],
    vocabulary: [
      { term: 'повторение', translation: 'review', priority: 'core', reviewBucket: 'active' },
      { term: 'ошибка', translation: 'error', priority: 'high', reviewBucket: 'active' },
      { term: 'ответ', translation: 'answer', priority: 'core', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'cp1a-recycle', type: 'recycle_review', title: 'Checkpoint recycle warm-up', required: true, payload: { focus: 'High-frequency recycle set', recycledItems: [{ term: 'клетка', translation: 'cell', priority: 'core', reviewBucket: 'recycle' }, { term: 'что такое', translation: 'what is', priority: 'core', reviewBucket: 'recycle' }], action: 'Quick oral recall before mixed tasks.' } },
      { id: 'cp1a-quiz', type: 'mini_quiz', title: 'Mixed mini-assessment', required: true, payload: { items: [{ question: 'Define клетка.', answer: 'Клетка — часть организма.' }, { question: 'Ask one clarification question.', answer: 'Повторите, пожалуйста.' }] } },
      { id: 'cp1a-scenario', type: 'task_scenario', title: 'Scenario checkpoint task', required: true, payload: { scenario: 'Teacher runs rapid mixed prompts.', task: 'Respond to 4 prompt types (definition, schedule, clarification, identity).', successCriteria: ['At least 3 correct responses'] } },
      { id: 'cp1a-teacher', type: 'teacher_prompt', title: 'Teacher checkpoint note', required: false, payload: { prompt: 'Log weakest domain after this checkpoint.', coachingTips: ['Tag: literacy/classroom/science', 'Assign remedial recycle list'] } },
      { id: 'cp1a-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Revise 15 checkpoint terms and write 5 correction lines.', submissionHint: 'Mark errors by type.' } },
    ],
  }),
  'checkpoint-01-b': buildLesson({
    lessonKey: 'checkpoint_01_b',
    lessonSlug: 'checkpoint-01-b',
    identity: { canonicalSlug: 'checkpoint-01-b', mappingMode: 'canonical', mappedConceptTitle: 'Checkpoint 01 B' },
    title: 'Checkpoint 01 B',
    objective: 'Second checkpoint pass with stronger task production and recycle pressure.',
    lane: 'classroom_foundation',
    lessonMode: 'practice',
    readinessTarget: 'Sustain performance under mixed production demands.',
    grammarFocus: ['mixed review'],
    functionFocus: ['checkpoint performance'],
    canDoOutcomes: ['Can complete mixed checkpoint production tasks with minimal prompts.'],
    teacherNotes: ['Compare with checkpoint 01A for progression trend.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['mini_quiz', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-checkpoint-01-b'],
    checkpointLinks: ['shared_core_checkpoint_01_v1'],
    mockLinks: [],
    vocabulary: [
      { term: 'объяснить', translation: 'to explain', priority: 'high', reviewBucket: 'active' },
      { term: 'сравнить', translation: 'to compare', priority: 'high', reviewBucket: 'active' },
      { term: 'критерий', translation: 'criterion', priority: 'medium', reviewBucket: 'new' },
    ],
    orderedBlocks: [
      { id: 'cp1b-recycle', type: 'recycle_review', title: 'Checkpoint recycle sprint', required: true, payload: { focus: 'Cross-lesson recall', recycledItems: [{ term: 'срок', translation: 'deadline', priority: 'core', reviewBucket: 'recycle' }, { term: 'поэтому', translation: 'therefore', priority: 'high', reviewBucket: 'recycle' }], action: 'Use both terms in short spoken answers.' } },
      { id: 'cp1b-quiz', type: 'mini_quiz', title: 'Checkpoint B mini-assessment', required: true, payload: { items: [{ question: 'Give cause-result sentence.', answer: '... потому что ..., поэтому ...' }, { question: 'State one deadline sentence.', answer: 'Срок до ...' }] } },
      { id: 'cp1b-scenario', type: 'task_scenario', title: 'Scenario: mixed oral station', required: true, payload: { scenario: 'Move through three oral stations.', task: 'Respond to definition, schedule, and motion prompts.', successCriteria: ['Correct in at least 2 stations'] } },
      { id: 'cp1b-teacher', type: 'teacher_prompt', title: 'Teacher prompt', required: false, payload: { prompt: 'Record remediation domains for each learner.', coachingTips: ['Use same rubric as 01A', 'Flag checkpoint readiness'] } },
      { id: 'cp1b-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Write one-page checkpoint reflection + 8 correction items.', submissionHint: 'Include one can-do self-rating section.' } },
    ],
  }),
  'checkpoint-01-review': buildLesson({
    lessonKey: 'checkpoint_01_review',
    lessonSlug: 'checkpoint-01-review',
    identity: { canonicalSlug: 'checkpoint-01-review', mappingMode: 'canonical', mappedConceptTitle: 'Checkpoint 01 Review' },
    title: 'Checkpoint 01 Review',
    objective: 'Targeted recycle/review after Checkpoint 01 attempts.',
    lane: 'classroom_foundation',
    lessonMode: 'blended',
    readinessTarget: 'Close key gaps before proceeding to later checkpoint family.',
    grammarFocus: ['targeted review'],
    functionFocus: ['remediation and consolidation'],
    canDoOutcomes: ['Can repair at least 3 prior checkpoint error patterns.'],
    teacherNotes: ['Use learner-specific error logs from 01A/01B.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['recycle_review', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-checkpoint-01-review'],
    checkpointLinks: ['shared_core_checkpoint_01_v1'],
    mockLinks: [],
    vocabulary: [
      { term: 'исправление', translation: 'correction', priority: 'high', reviewBucket: 'active' },
      { term: 'повтор', translation: 'repeat/review cycle', priority: 'high', reviewBucket: 'active' },
      { term: 'цель', translation: 'target', priority: 'medium', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'cp1r-recycle', type: 'recycle_review', title: 'Checkpoint 01 recycle bank', required: true, payload: { focus: 'Aggregate weak items from 01A/01B', recycledItems: [{ term: 'Повторите, пожалуйста', translation: 'Repeat, please', priority: 'core', reviewBucket: 'recycle' }, { term: 'поэтому', translation: 'therefore', priority: 'high', reviewBucket: 'recycle' }], action: 'Run spaced oral recall rounds.' } },
      { id: 'cp1r-task', type: 'task_scenario', title: 'Scenario: corrective classroom exchange', required: true, payload: { scenario: 'You must repair incorrect responses from prior checkpoint.', task: 'Produce corrected versions for 4 prompts.', successCriteria: ['3+ corrected accurately'] } },
      { id: 'cp1r-quiz', type: 'mini_quiz', title: 'Review check', required: true, payload: { items: [{ question: 'Correct this deadline sentence.', answer: '...до пятницы...' }] } },
      { id: 'cp1r-teacher', type: 'teacher_prompt', title: 'Teacher remediation note', required: false, payload: { prompt: 'Assign each learner a final recycle bucket set.', coachingTips: ['Use active/recycle tags', 'Keep set <= 20 items'] } },
      { id: 'cp1r-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Submit corrected answer pack for weakest 10 items.', submissionHint: 'Categorize each item by error type.' } },
    ],
  }),
  'checkpoint-02-a': buildLesson({
    lessonKey: 'checkpoint_02_a',
    lessonSlug: 'checkpoint-02-a',
    identity: { canonicalSlug: 'checkpoint-02-a', mappingMode: 'canonical', mappedConceptTitle: 'Checkpoint 02 A' },
    title: 'Checkpoint 02 A',
    objective: 'Mixed review checkpoint for the full 30-lesson Phase 1 slice (first pass).',
    lane: 'classroom_foundation',
    lessonMode: 'practice',
    readinessTarget: 'Demonstrate integrated performance across literacy/classroom/science/biology starter content.',
    grammarFocus: ['integrated review'],
    functionFocus: ['checkpoint performance'],
    canDoOutcomes: ['Can complete integrated checkpoint tasks across full Phase 1 topics.'],
    teacherNotes: ['Treat this as readiness preview, not formal exam truth.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['mini_quiz', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-checkpoint-02-a'],
    checkpointLinks: ['shared_core_checkpoint_02_v1'],
    mockLinks: [],
    vocabulary: [
      { term: 'интеграция', translation: 'integration', priority: 'medium', reviewBucket: 'new' },
      { term: 'обзор', translation: 'overview/review', priority: 'high', reviewBucket: 'active' },
      { term: 'готовность', translation: 'readiness', priority: 'core', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'cp2a-recycle', type: 'recycle_review', title: 'Full-slice recycle warm-up', required: true, payload: { focus: 'Cross-lane recall', recycledItems: [{ term: 'клетка', translation: 'cell', priority: 'core', reviewBucket: 'recycle' }, { term: 'расписание', translation: 'schedule', priority: 'core', reviewBucket: 'recycle' }, { term: 'что такое', translation: 'what is', priority: 'core', reviewBucket: 'recycle' }], action: '1-minute recall per lane.' } },
      { id: 'cp2a-quiz', type: 'mini_quiz', title: 'Integrated mini-assessment', required: true, payload: { items: [{ question: 'Classify one scientific term and define it.', answer: '...' }, { question: 'State one schedule deadline line.', answer: '...' }] } },
      { id: 'cp2a-scenario', type: 'task_scenario', title: 'Scenario: rapid mixed station', required: true, payload: { scenario: 'Teacher rotates through 5 topic prompts.', task: 'Respond within 20 seconds each.', successCriteria: ['4/5 intelligible responses'] } },
      { id: 'cp2a-teacher', type: 'teacher_prompt', title: 'Teacher readiness prompt', required: false, payload: { prompt: 'Tag learners as building/on_track for Phase 2 prep.', coachingTips: ['Base on response completeness', 'Track recycle burden'] } },
      { id: 'cp2a-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Prepare a personal weak-point review list from this checkpoint.', submissionHint: 'Group by lane and by can-do outcome.' } },
    ],
  }),
  'checkpoint-02-b': buildLesson({
    lessonKey: 'checkpoint_02_b',
    lessonSlug: 'checkpoint-02-b',
    identity: { canonicalSlug: 'checkpoint-02-b', mappingMode: 'canonical', mappedConceptTitle: 'Checkpoint 02 B' },
    title: 'Checkpoint 02 B',
    objective: 'Second integrated checkpoint pass with stronger production emphasis.',
    lane: 'classroom_foundation',
    lessonMode: 'practice',
    readinessTarget: 'Show improved integrated performance after remediation.',
    grammarFocus: ['integrated review'],
    functionFocus: ['checkpoint performance'],
    canDoOutcomes: ['Can complete full-slice mixed tasks with less teacher prompting.'],
    teacherNotes: ['Compare trend against checkpoint 02A.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 75, mustCompleteBlockTypes: ['mini_quiz', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-checkpoint-02-b'],
    checkpointLinks: ['shared_core_checkpoint_02_v1'],
    mockLinks: [],
    vocabulary: [
      { term: 'достижение', translation: 'achievement', priority: 'medium', reviewBucket: 'new' },
      { term: 'прогресс', translation: 'progress', priority: 'core', reviewBucket: 'active' },
      { term: 'оценка', translation: 'evaluation', priority: 'high', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'cp2b-recycle', type: 'recycle_review', title: 'Focused recycle by weak lane', required: true, payload: { focus: 'Lane-targeted recall before assessment', recycledItems: [{ term: 'срок', translation: 'deadline', priority: 'core', reviewBucket: 'recycle' }, { term: 'организм', translation: 'organism', priority: 'core', reviewBucket: 'recycle' }], action: 'Prioritize weakest lane first.' } },
      { id: 'cp2b-quiz', type: 'mini_quiz', title: 'Integrated checkpoint B quiz', required: true, payload: { items: [{ question: 'Provide one cause-result science sentence.', answer: '...' }, { question: 'Ask and answer one clarification exchange.', answer: '...' }] } },
      { id: 'cp2b-scenario', type: 'task_scenario', title: 'Scenario: mixed dialogue assessment', required: true, payload: { scenario: 'Teacher + peer roleplay covers schedule, science, and identity prompts.', task: 'Respond across all three domains.', successCriteria: ['No domain omitted', 'Responses mostly accurate'] } },
      { id: 'cp2b-teacher', type: 'teacher_prompt', title: 'Teacher checkpoint note', required: false, payload: { prompt: 'Record if learner is ready for checkpoint review closure.', coachingTips: ['Use consistency over perfection', 'Capture recurring lexical gaps'] } },
      { id: 'cp2b-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Submit a remediation pack for remaining weak domains.', submissionHint: 'Include can-do self-assessment (1-5 scale).' } },
    ],
  }),
  'checkpoint-02-review': buildLesson({
    lessonKey: 'checkpoint_02_review',
    lessonSlug: 'checkpoint-02-review',
    identity: { canonicalSlug: 'checkpoint-02-review', mappingMode: 'canonical', mappedConceptTitle: 'Checkpoint 02 Review' },
    title: 'Checkpoint 02 Review',
    objective: 'Final Phase 1 review consolidation before later-phase expansion.',
    lane: 'classroom_foundation',
    lessonMode: 'blended',
    readinessTarget: 'Consolidate full Phase 1 can-do outcomes with recycle-first remediation.',
    grammarFocus: ['integrated review'],
    functionFocus: ['consolidation'],
    canDoOutcomes: ['Can demonstrate stable responses across full Phase 1 can-do targets.'],
    teacherNotes: ['This is a consolidation lesson, not a final exam closure claim.'],
    masteryRules: { minimumRequiredBlocks: 5, minimumQuizScore: 70, mustCompleteBlockTypes: ['recycle_review', 'task_scenario', 'homework_assignment'] },
    homeworkRefs: ['hw-checkpoint-02-review'],
    checkpointLinks: ['shared_core_checkpoint_02_v1'],
    mockLinks: [],
    vocabulary: [
      { term: 'закрепление', translation: 'consolidation', priority: 'high', reviewBucket: 'active' },
      { term: 'повторить', translation: 'to review again', priority: 'core', reviewBucket: 'active' },
      { term: 'уверенно', translation: 'confidently', priority: 'medium', reviewBucket: 'active' },
    ],
    orderedBlocks: [
      { id: 'cp2r-recycle', type: 'recycle_review', title: 'Full phase recycle matrix', required: true, payload: { focus: 'Revisit all lane anchor vocabulary', recycledItems: [{ term: 'буква', translation: 'letter', priority: 'core', reviewBucket: 'recycle' }, { term: 'что такое', translation: 'what is', priority: 'core', reviewBucket: 'recycle' }, { term: 'организм', translation: 'organism', priority: 'core', reviewBucket: 'recycle' }], action: 'Lane-by-lane recall and sentence production.' } },
      { id: 'cp2r-task', type: 'task_scenario', title: 'Scenario: integrated teaching round', required: true, payload: { scenario: 'Learner explains key concepts to a new student.', task: 'Cover literacy, classroom, science, and biology basics.', successCriteria: ['All four domains mentioned', 'Mostly intelligible output'] } },
      { id: 'cp2r-quiz', type: 'mini_quiz', title: 'Final review check', required: true, payload: { items: [{ question: 'State one can-do from each lane.', answer: '...' }] } },
      { id: 'cp2r-teacher', type: 'teacher_prompt', title: 'Teacher consolidation prompt', required: false, payload: { prompt: 'Set carry-forward recycle list for Phase 2 start.', coachingTips: ['Max 25 items', 'Prioritize high-impact gaps'] } },
      { id: 'cp2r-home', type: 'homework_assignment', title: 'Homework', required: true, payload: { task: 'Build a personal Phase 1 review notebook (vocab + can-do + error fixes).', submissionHint: 'Organize by lane and review bucket.' } },
    ],
  }),
};

export function getRussianRuntimeLesson(lessonSlug: string) {
  return russianPhase1ALessons[lessonSlug] ?? null;
}

export function getPhase1AVocabSummary(progressCompletedLessonSlugs: string[]) {
  const completed = PHASE_1A_LESSON_ORDER.filter((slug) => progressCompletedLessonSlugs.includes(slug));
  const lessonSet = new Set(completed);
  const vocab = PHASE_1A_LESSON_ORDER.flatMap((slug) => russianPhase1ALessons[slug].vocabulary.map((item) => ({ ...item, lessonSlug: slug, completed: lessonSet.has(slug) })));
  const total = vocab.length;
  const completedLoad = vocab.filter((item) => item.completed).length;
  const coreLoad = vocab.filter((item) => item.priority === 'core').length;
  const readinessSignal = completed.length >= 6 ? 'building' : completed.length >= 3 ? 'emerging' : 'starting';

  return {
    phaseLessonsTotal: PHASE_1A_LESSON_ORDER.length,
    phaseLessonsCompleted: completed.length,
    vocabTotal: total,
    vocabFromCompletedLessons: completedLoad,
    coreVocabTotal: coreLoad,
    readinessSignal,
    source: 'local_preview' as const,
    laneProgress: {
      literacy: (['alphabet-map', 'sound-rules', 'handwriting-decoding', 'greetings', 'self-introduction'] as const).filter((slug) => completed.includes(slug)).length,
      classroom_foundation: (['personal-information', 'numbers-dates-time', 'directions-places', 'shopping-transport', 'university-vocabulary'] as const).filter((slug) => completed.includes(slug)).length,
    },
  };
}

export function getPhase1BVocabSummary(progressCompletedLessonSlugs: string[]) {
  const completed = PHASE_1B_LESSON_ORDER.filter((slug) => progressCompletedLessonSlugs.includes(slug));
  const completedSet = new Set(completed);
  const vocab = PHASE_1B_LESSON_ORDER.flatMap((slug) =>
    russianPhase1ALessons[slug].vocabulary.map((item) => ({ ...item, lessonSlug: slug, isCompletedLesson: completedSet.has(slug) }))
  );

  const recyclable = vocab.filter((item) => item.reviewBucket === 'recycle').length;
  const active = vocab.filter((item) => item.reviewBucket === 'active').length;

  return {
    phaseLessonsTotal: PHASE_1B_LESSON_ORDER.length,
    phaseLessonsCompleted: completed.length,
    vocabTotal: vocab.length,
    recyclableVocab: recyclable,
    activeVocab: active,
    canDoReadyLessons: completed.length,
    source: 'local_preview' as const,
  };
}

export function getPhase1CSummary(progressCompletedLessonSlugs: string[]) {
  const completed = PHASE_1C_LESSON_ORDER.filter((slug) => progressCompletedLessonSlugs.includes(slug));
  const checkpointLessons = PHASE_1C_LESSON_ORDER.filter((slug) => slug.startsWith('checkpoint-'));
  const completedSet = new Set(completed);

  return {
    phaseLessonsTotal: PHASE_1C_LESSON_ORDER.length,
    phaseLessonsCompleted: completed.length,
    checkpointLessonsTotal: checkpointLessons.length,
    checkpointLessonsCompleted: checkpointLessons.filter((slug) => completedSet.has(slug)).length,
    source: 'local_preview' as const,
  };
}

export function getFullPhase1Summary(progressCompletedLessonSlugs: string[]) {
  const fullOrder = [...PHASE_1A_LESSON_ORDER, ...PHASE_1B_LESSON_ORDER, ...PHASE_1C_LESSON_ORDER];
  const completed = fullOrder.filter((slug) => progressCompletedLessonSlugs.includes(slug)).length;
  const lessonsWithCanDo = fullOrder.filter((slug) => (russianPhase1ALessons[slug]?.canDoOutcomes?.length ?? 0) > 0).length;
  const lessonsWithScenario = fullOrder.filter((slug) => russianPhase1ALessons[slug]?.orderedBlocks.some((b) => b.type === 'task_scenario')).length;

  return {
    totalLessons: fullOrder.length,
    completedLessons: completed,
    lessonsWithCanDo,
    lessonsWithScenario,
    source: 'local_preview' as const,
  };
}
