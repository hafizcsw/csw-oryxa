import alphabetMapImage from '@/assets/russian-media/images/alphabet-map.svg';
import soundRulesContrastImage from '@/assets/russian-media/images/sound-rules-contrast.svg';
import stressMarkersImage from '@/assets/russian-media/images/stress-markers.svg';
import classroomDirectionsImage from '@/assets/russian-media/images/classroom-directions.svg';
import numbersTimeBoardImage from '@/assets/russian-media/images/numbers-time-board.svg';
import printCursivePairsImage from '@/assets/russian-media/images/print-cursive-pairs.svg';
import personalInfoDialogueBoardImage from '@/assets/russian-media/images/personal-info-dialogue-board.svg';
import shoppingTransportBoardImage from '@/assets/russian-media/images/shopping-transport-board.svg';
import universityVocabularyBoardImage from '@/assets/russian-media/images/university-vocabulary-board.svg';
import alphabetOverviewImage from '@/assets/russian-media/images/alphabet-overview.jpg';
import voicedUnvoicedPairsImage from '@/assets/russian-media/images/voiced-unvoiced-pairs.jpg';
import stressVowelReductionImage from '@/assets/russian-media/images/stress-vowel-reduction.jpg';

export type RussianMediaAssetType = 'audio' | 'image';

export interface RussianMediaAsset {
  id: string;
  type: RussianMediaAssetType;
  lessons: string[];
  src: string;
  transcript?: string;
  alt?: string;
  caption?: string;
  durationSeconds?: number;
}

export const russianLessonMediaRegistry: Record<string, RussianMediaAsset> = {
  'ru.alphabet.map.v1': {
    id: 'ru.alphabet.map.v1',
    type: 'image',
    lessons: ['alphabet-map'],
    src: alphabetMapImage,
    alt: 'Cyrillic letter-to-sound map for beginner decoding drills.',
    caption: 'High-frequency letters with starter examples.',
  },
  'ru.alphabet.overview.v1': {
    id: 'ru.alphabet.overview.v1',
    type: 'image',
    lessons: ['alphabet-map'],
    src: alphabetOverviewImage,
    alt: 'Russian alphabet overview showing vowels, consonants, and signs.',
    caption: 'All 33 letters organized by category.',
  },
  'ru.sound_rules.contrast_chart.v1': {
    id: 'ru.sound_rules.contrast_chart.v1',
    type: 'image',
    lessons: ['sound-rules'],
    src: soundRulesContrastImage,
    alt: 'Voiced and unvoiced consonant contrast chart for Russian letters.',
    caption: 'Use while contrasting Б/П and Д/Т.',
  },
  'ru.sound_rules.voiced_unvoiced.v1': {
    id: 'ru.sound_rules.voiced_unvoiced.v1',
    type: 'image',
    lessons: ['sound-rules'],
    src: voicedUnvoicedPairsImage,
    alt: 'Russian consonant pairs: voiced vs unvoiced.',
    caption: 'Voiced consonants on left, unvoiced on right.',
  },
  'ru.handwriting.stress_markers.v1': {
    id: 'ru.handwriting.stress_markers.v1',
    type: 'image',
    lessons: ['handwriting-decoding'],
    src: stressMarkersImage,
    alt: 'Stress marker visual with three high-frequency Russian words.',
    caption: 'Visual cue for clapping stressed syllables.',
  },
  'ru.stress.vowel_reduction.v1': {
    id: 'ru.stress.vowel_reduction.v1',
    type: 'image',
    lessons: ['handwriting-decoding'],
    src: stressVowelReductionImage,
    alt: 'How unstressed О sounds like А in the word молоко.',
    caption: 'Vowel reduction: unstressed О → /a/.',
  },
  'ru.directions.classroom_map.v1': {
    id: 'ru.directions.classroom_map.v1',
    type: 'image',
    lessons: ['directions-places'],
    src: classroomDirectionsImage,
    alt: 'Classroom map showing board, desk, and door locations.',
    caption: 'Supports preposition drills with object locations.',
  },
  'ru.numbers.time_board.v1': {
    id: 'ru.numbers.time_board.v1',
    type: 'image',
    lessons: ['numbers-dates-time'],
    src: numbersTimeBoardImage,
    alt: 'Visual board for date and time examples in Russian.',
    caption: 'Reference for date and age response patterns.',
  },
  'ru.greetings.print_cursive_pairs.v1': {
    id: 'ru.greetings.print_cursive_pairs.v1',
    type: 'image',
    lessons: ['greetings'],
    src: printCursivePairsImage,
    alt: 'Reference chart comparing print and cursive letter pairs.',
    caption: 'Supports quick visual checking during handwriting drills.',
  },
  'ru.personal_info.dialogue_board.v1': {
    id: 'ru.personal_info.dialogue_board.v1',
    type: 'image',
    lessons: ['personal-information'],
    src: personalInfoDialogueBoardImage,
    alt: 'Dialogue board for greeting, name, age, and origin prompts.',
    caption: 'Visual scaffold for structured self-introduction output.',
  },
  'ru.shopping_transport.phrase_board.v1': {
    id: 'ru.shopping_transport.phrase_board.v1',
    type: 'image',
    lessons: ['shopping-transport'],
    src: shoppingTransportBoardImage,
    alt: 'Phrase board for shopping and transport classroom roleplay.',
    caption: 'Functional expressions for transactional practice.',
  },
  'ru.university.vocabulary_board.v1': {
    id: 'ru.university.vocabulary_board.v1',
    type: 'image',
    lessons: ['university-vocabulary'],
    src: universityVocabularyBoardImage,
    alt: 'University vocabulary board with key campus nouns and command sequence.',
    caption: 'Supports rapid recognition of classroom and campus words.',
  },
};

export function resolveRussianMediaAsset(assetId?: string) {
  if (!assetId) return null;
  return russianLessonMediaRegistry[assetId] ?? null;
}
