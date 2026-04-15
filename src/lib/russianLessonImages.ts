// Lesson illustration image registry — maps lesson slugs to realistic photos
import alphabetMap from '@/assets/russian-lessons/alphabet-map.jpg';
import soundRules from '@/assets/russian-lessons/sound-rules.jpg';
import handwritingDecoding from '@/assets/russian-lessons/handwriting-decoding.jpg';
import greetings from '@/assets/russian-lessons/greetings.jpg';
import selfIntroduction from '@/assets/russian-lessons/self-introduction.jpg';
import personalInformation from '@/assets/russian-lessons/personal-information.jpg';
import numbersDatesTime from '@/assets/russian-lessons/numbers-dates-time.jpg';
import directionsPlaces from '@/assets/russian-lessons/directions-places.jpg';
import shoppingTransport from '@/assets/russian-lessons/shopping-transport.jpg';
import universityVocabulary from '@/assets/russian-lessons/university-vocabulary.jpg';
import classroomPhrases from '@/assets/russian-lessons/classroom-phrases.jpg';
import instructionsQuestions from '@/assets/russian-lessons/instructions-questions.jpg';
import readingNotices from '@/assets/russian-lessons/reading-notices.jpg';
import formsLabels from '@/assets/russian-lessons/forms-labels.jpg';
import shortAcademicTexts from '@/assets/russian-lessons/short-academic-texts.jpg';
import lectureListeningCues from '@/assets/russian-lessons/lecture-listening-cues.jpg';
import noteTakingPhrases from '@/assets/russian-lessons/note-taking-phrases.jpg';
import shortWrittenResponses from '@/assets/russian-lessons/short-written-responses.jpg';
import nounGenderNumber from '@/assets/russian-lessons/noun-gender-number.jpg';
import casePatternAwareness from '@/assets/russian-lessons/case-pattern-awareness.jpg';
import adjectiveAgreementBasics from '@/assets/russian-lessons/adjective-agreement-basics.jpg';
import presentPastFuture from '@/assets/russian-lessons/present-past-future.jpg';
import motionVerbsIntro from '@/assets/russian-lessons/motion-verbs-intro.jpg';
import schedulesDeadlines from '@/assets/russian-lessons/schedules-deadlines.jpg';
import checkpoint01a from '@/assets/russian-lessons/checkpoint-01-a.jpg';
import checkpoint01b from '@/assets/russian-lessons/checkpoint-01-b.jpg';
import checkpoint01review from '@/assets/russian-lessons/checkpoint-01-review.jpg';
import checkpoint02a from '@/assets/russian-lessons/checkpoint-02-a.jpg';
import checkpoint02b from '@/assets/russian-lessons/checkpoint-02-b.jpg';
import checkpoint02review from '@/assets/russian-lessons/checkpoint-02-review.jpg';

const LESSON_IMAGES: Record<string, string> = {
  'alphabet-map': alphabetMap,
  'sound-rules': soundRules,
  'handwriting-decoding': handwritingDecoding,
  'greetings': greetings,
  'self-introduction': selfIntroduction,
  'personal-information': personalInformation,
  'numbers-dates-time': numbersDatesTime,
  'directions-places': directionsPlaces,
  'shopping-transport': shoppingTransport,
  'university-vocabulary': universityVocabulary,
  'classroom-phrases': classroomPhrases,
  'instructions-questions': instructionsQuestions,
  'reading-notices': readingNotices,
  'forms-labels': formsLabels,
  'short-academic-texts': shortAcademicTexts,
  'lecture-listening-cues': lectureListeningCues,
  'note-taking-phrases': noteTakingPhrases,
  'short-written-responses': shortWrittenResponses,
  'noun-gender-number': nounGenderNumber,
  'case-pattern-awareness': casePatternAwareness,
  'adjective-agreement-basics': adjectiveAgreementBasics,
  'present-past-future': presentPastFuture,
  'motion-verbs-intro': motionVerbsIntro,
  'schedules-deadlines': schedulesDeadlines,
  'checkpoint-01-a': checkpoint01a,
  'checkpoint-01-b': checkpoint01b,
  'checkpoint-01-review': checkpoint01review,
  'checkpoint-02-a': checkpoint02a,
  'checkpoint-02-b': checkpoint02b,
  'checkpoint-02-review': checkpoint02review,
};

export function getLessonImage(lessonSlug: string): string | null {
  return LESSON_IMAGES[lessonSlug] ?? null;
}
