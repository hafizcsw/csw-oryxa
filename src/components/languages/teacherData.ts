import teacher1 from "@/assets/teachers/teacher-1.jpg";
import teacher2 from "@/assets/teachers/teacher-2.jpg";
import teacher3 from "@/assets/teachers/teacher-3.jpg";
import teacher4 from "@/assets/teachers/teacher-4.jpg";
import teacher5 from "@/assets/teachers/teacher-5.jpg";
import teacher6 from "@/assets/teachers/teacher-6.jpg";
import type { TeacherData } from "./TeacherCard";

export interface TeacherReview {
  id: string;
  name: string;
  avatar?: string;
  date: string;
  lessonsCount: number;
  text: string;
}

export interface TeacherExtended extends TeacherData {
  aboutKey: string;
  experienceKey: string;
  educationKey: string;
  lessonRatings: {
    encouragement: number;
    clarity: number;
    progress: number;
    preparation: number;
  };
  responseTime: string;
  reviews: TeacherReview[];
}

/** Real teacher user ID in CRM storage */
export const MOHAMED_AMIN_USER_ID = "a36ba59a-2529-422d-bc07-4e001aef2409";

/** Default fallback avatar (may be stale) */
const MOHAMED_AMIN_AVATAR_FALLBACK = "https://hlrkyoxwbjsgqbncgzpi.supabase.co/storage/v1/object/public/avatars/a36ba59a-2529-422d-bc07-4e001aef2409/avatar/1774624919891______________2026-03-27____6.04.23__.png";

export const MOCK_TEACHERS: TeacherExtended[] = [
  {
    id: "t0",
    name: "Mohamed Amin",
    avatar: MOHAMED_AMIN_AVATAR_FALLBACK,
    country: "Uzbekistan",
    countryFlag: "uz",
    rating: 5,
    reviewsCount: 18,
    studentsCount: 32,
    lessonsCount: 310,
    priceUsd: 45,
    badges: ["super", "professional"],
    languagesSpoken: ["Russian (Fluent)", "English (Advanced)"],
    descriptionKey: "languages.teachers.desc.t0",
    specialtyKey: "languages.teachers.spec.t0",
    bookedRecently: 15,
    aboutKey: "languages.teachers.about.t0",
    experienceKey: "languages.teachers.experience.t0",
    educationKey: "languages.teachers.education.t0",
    lessonRatings: { encouragement: 5, clarity: 5, progress: 4.9, preparation: 5 },
    responseTime: "1h",
    reviews: [
      { id: "r1", name: "أحمد", date: "2026-03-15", lessonsCount: 24, text: "languages.teachers.reviews.t0.r1" },
      { id: "r2", name: "سارة", date: "2026-02-20", lessonsCount: 12, text: "languages.teachers.reviews.t0.r2" },
      { id: "r3", name: "خالد", date: "2026-01-10", lessonsCount: 8, text: "languages.teachers.reviews.t0.r3" },
    ],
  },
  {
    id: "t1",
    name: "Vasilisa G.",
    avatar: teacher1,
    country: "Russia",
    countryFlag: "ru",
    rating: 5,
    reviewsCount: 14,
    studentsCount: 14,
    lessonsCount: 186,
    priceUsd: 55,
    badges: ["super"],
    languagesSpoken: ["Russian (Native)", "English (Advanced)"],
    descriptionKey: "languages.teachers.desc.t1",
    specialtyKey: "languages.teachers.spec.t1",
    bookedRecently: 6,
    aboutKey: "languages.teachers.about.t1",
    experienceKey: "languages.teachers.experience.t1",
    educationKey: "languages.teachers.education.t1",
    lessonRatings: { encouragement: 5, clarity: 4.9, progress: 4.8, preparation: 4.9 },
    responseTime: "2h",
    reviews: [
      { id: "r1", name: "Omar", date: "2026-03-01", lessonsCount: 10, text: "languages.teachers.reviews.t1.r1" },
    ],
  },
  {
    id: "t2",
    name: "Gulnara G.",
    avatar: teacher2,
    country: "Russia",
    countryFlag: "ru",
    rating: 5,
    reviewsCount: 12,
    studentsCount: 27,
    lessonsCount: 274,
    priceUsd: 37,
    badges: ["super", "professional"],
    languagesSpoken: ["Russian (Native)", "English (Advanced)", "Arabic (Intermediate)"],
    descriptionKey: "languages.teachers.desc.t2",
    specialtyKey: "languages.teachers.spec.t2",
    bookedRecently: 8,
    aboutKey: "languages.teachers.about.t2",
    experienceKey: "languages.teachers.experience.t2",
    educationKey: "languages.teachers.education.t2",
    lessonRatings: { encouragement: 4.9, clarity: 5, progress: 4.8, preparation: 5 },
    responseTime: "3h",
    reviews: [
      { id: "r1", name: "Youssef", date: "2026-02-15", lessonsCount: 20, text: "languages.teachers.reviews.t2.r1" },
    ],
  },
  {
    id: "t3",
    name: "Dmitry K.",
    avatar: teacher3,
    country: "Russia",
    countryFlag: "ru",
    rating: 5,
    reviewsCount: 8,
    studentsCount: 22,
    lessonsCount: 127,
    priceUsd: 29,
    badges: [],
    languagesSpoken: ["Russian (Native)", "English (Advanced)", "German (Pre-Intermediate)"],
    descriptionKey: "languages.teachers.desc.t3",
    specialtyKey: "languages.teachers.spec.t3",
    aboutKey: "languages.teachers.about.t3",
    experienceKey: "languages.teachers.experience.t3",
    educationKey: "languages.teachers.education.t3",
    lessonRatings: { encouragement: 4.8, clarity: 4.9, progress: 4.7, preparation: 4.8 },
    responseTime: "4h",
    reviews: [],
  },
  {
    id: "t4",
    name: "Alina A.",
    avatar: teacher4,
    country: "Russia",
    countryFlag: "ru",
    rating: 5,
    reviewsCount: 2,
    studentsCount: 12,
    lessonsCount: 39,
    priceUsd: 29,
    badges: [],
    languagesSpoken: ["Russian (Native)", "English (Intermediate)"],
    descriptionKey: "languages.teachers.desc.t4",
    specialtyKey: "languages.teachers.spec.t4",
    bookedRecently: 10,
    aboutKey: "languages.teachers.about.t4",
    experienceKey: "languages.teachers.experience.t4",
    educationKey: "languages.teachers.education.t4",
    lessonRatings: { encouragement: 5, clarity: 4.8, progress: 4.9, preparation: 4.7 },
    responseTime: "2h",
    reviews: [],
  },
  {
    id: "t5",
    name: "Akylay T.",
    avatar: teacher5,
    country: "Russia",
    countryFlag: "ru",
    rating: 5,
    reviewsCount: 24,
    studentsCount: 24,
    lessonsCount: 1044,
    priceUsd: 55,
    badges: ["professional"],
    languagesSpoken: ["Russian (Native)", "English (Advanced)"],
    descriptionKey: "languages.teachers.desc.t5",
    specialtyKey: "languages.teachers.spec.t5",
    bookedRecently: 13,
    aboutKey: "languages.teachers.about.t5",
    experienceKey: "languages.teachers.experience.t5",
    educationKey: "languages.teachers.education.t5",
    lessonRatings: { encouragement: 5, clarity: 5, progress: 5, preparation: 5 },
    responseTime: "1h",
    reviews: [],
  },
  {
    id: "t6",
    name: "Oxana Z.",
    avatar: teacher6,
    country: "Russia",
    countryFlag: "ru",
    rating: 5,
    reviewsCount: 11,
    studentsCount: 21,
    lessonsCount: 53,
    priceUsd: 40,
    badges: ["professional"],
    languagesSpoken: ["Russian (Native)", "German (Native)", "English (Advanced)"],
    descriptionKey: "languages.teachers.desc.t6",
    specialtyKey: "languages.teachers.spec.t6",
    bookedRecently: 13,
    aboutKey: "languages.teachers.about.t6",
    experienceKey: "languages.teachers.experience.t6",
    educationKey: "languages.teachers.education.t6",
    lessonRatings: { encouragement: 4.9, clarity: 5, progress: 4.8, preparation: 5 },
    responseTime: "3h",
    reviews: [],
  },
];
