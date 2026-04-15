// Country-specific configuration for harvest operations
// Each profile defines language, currency, and terminology for fee/admission detection

export interface CountryProfile {
  code: string;
  name: string;
  locales: string[];
  currency: string;
  academicYearStartsMonth: number;
  feeTerms: string[];
  admissionTerms: string[];
  scholarshipTerms: string[];
  wikiSlug?: string; // Wikipedia slug override
  urlHintsFee?: string[]; // URL patterns for fee pages
  urlHintsAdm?: string[]; // URL patterns for admission pages
}

export const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  GB: {
    code: "GB",
    name: "United Kingdom",
    locales: ["en"],
    currency: "GBP",
    academicYearStartsMonth: 9,
    feeTerms: [
      "tuition", "tuition fees", "tuition fee", "fees", "fee",
      "fees and funding", "funding", "finance", "student finance",
      "international fees", "home fees", "overseas fees", "fee status",
      "cost of study", "course fees", "programme fees", "annual fee"
    ],
    admissionTerms: [
      "admission", "admissions", "entry requirements", "entry requirement",
      "requirements", "requirement", "apply", "how to apply", "application",
      "applying", "eligibility", "academic requirements",
      "undergraduate admission", "postgraduate admission"
    ],
    scholarshipTerms: ["scholarship", "bursary", "financial aid", "funding"],
    urlHintsFee: ["fees-and-funding", "tuition-fees", "study/fees", "/fees/", "/funding/"],
    urlHintsAdm: ["entry-requirements", "/admissions/", "/apply/", "how-to-apply"],
    wikiSlug: "https://en.wikipedia.org/wiki/List_of_universities_in_the_United_Kingdom"
  },
  US: {
    code: "US",
    name: "United States",
    locales: ["en"],
    currency: "USD",
    academicYearStartsMonth: 8,
    feeTerms: [
      "tuition", "tuition and fees", "cost of attendance", "tuition rate",
      "tuition costs", "fee schedule", "undergraduate tuition", "graduate tuition"
    ],
    admissionTerms: [
      "admission", "admissions", "requirements", "apply", "application",
      "freshman admission", "graduate admission", "transfer admission",
      "how to apply", "admission requirements"
    ],
    scholarshipTerms: ["scholarship", "financial aid", "grants", "aid"],
    wikiSlug: "https://en.wikipedia.org/wiki/List_of_universities_in_the_United_States"
  },
  DE: {
    code: "DE",
    name: "Germany",
    locales: ["de", "en"],
    currency: "EUR",
    academicYearStartsMonth: 10,
    feeTerms: [
      "Studiengebühren", "Semesterbeitrag", "Studienbeitrag", "Kosten", "Gebühren",
      "tuition", "fees", "tuition fees", "semester fees"
    ],
    admissionTerms: [
      "Zulassung", "Bewerbung", "Zugangsvoraussetzungen", "Voraussetzungen", "Anforderungen", "Bewerben",
      "admission", "requirements", "apply", "application"
    ],
    scholarshipTerms: ["Stipendium", "scholarship", "Förderung", "funding"],
    urlHintsFee: ["semesterbeitrag", "studiengebuehren", "studienbeitrag", "/fees/", "/tuition/"],
    urlHintsAdm: ["zulassung", "bewerbung", "zugangsvoraussetzungen", "/admission/", "/apply/"],
    wikiSlug: "https://en.wikipedia.org/wiki/List_of_universities_in_Germany"
  },
  FR: {
    code: "FR",
    name: "France",
    locales: ["fr", "en"],
    currency: "EUR",
    academicYearStartsMonth: 9,
    feeTerms: [
      "frais de scolarité", "droits d'inscription", "coût", "frais",
      "tuition", "fees", "tuition fees"
    ],
    admissionTerms: [
      "admission", "candidature", "conditions d'admission", "inscription",
      "apply", "application", "requirements"
    ],
    scholarshipTerms: ["bourse", "scholarship", "aide financière", "financial aid"],
    wikiSlug: "https://en.wikipedia.org/wiki/List_of_universities_in_France"
  },
  RU: {
    code: "RU",
    name: "Russia",
    locales: ["ru", "en"],
    currency: "RUB",
    academicYearStartsMonth: 9,
    feeTerms: [
      "стоимость обучения", "оплата обучения", "плата за обучение", "оплата", "стоимость", "расценки",
      "tuition", "fees", "cost of study"
    ],
    admissionTerms: [
      "поступление", "прием", "требования", "для иностранных студентов", "условия поступления",
      "admission", "requirements", "apply"
    ],
    scholarshipTerms: ["стипендия", "scholarship", "грант", "grant"],
    urlHintsFee: ["stoimost", "oplata", "/tuition", "/fees", "stoimost-obucheniya", "/interna.*fees"],
    urlHintsAdm: ["postuplenie", "priem", "trebovaniya", "inostrann", "/admission", "/apply"],
    wikiSlug: "https://en.wikipedia.org/wiki/List_of_universities_in_Russia"
  },
  TR: {
    code: "TR",
    name: "Turkey",
    locales: ["tr", "en"],
    currency: "TRY",
    academicYearStartsMonth: 9,
    feeTerms: [
      "ücret", "öğrenim ücreti", "eğitim ücreti", "harç",
      "tuition", "fees", "tuition fees"
    ],
    admissionTerms: [
      "kabul", "başvuru", "koşullar", "şartlar",
      "admission", "requirements", "apply", "application"
    ],
    scholarshipTerms: ["burs", "scholarship", "mali yardım", "financial aid"],
    wikiSlug: "https://en.wikipedia.org/wiki/List_of_universities_in_Turkey"
  },
  SA: {
    code: "SA",
    name: "Saudi Arabia",
    locales: ["ar", "en"],
    currency: "SAR",
    academicYearStartsMonth: 9,
    feeTerms: [
      "الرسوم", "الرسوم الدراسية", "تكلفة الدراسة", "المصروفات",
      "tuition", "fees", "tuition fees"
    ],
    admissionTerms: [
      "القبول", "شروط القبول", "متطلبات القبول", "التقديم",
      "admission", "requirements", "apply", "application"
    ],
    scholarshipTerms: ["المنحة", "المنح", "scholarship", "منحة دراسية"],
    wikiSlug: "https://ar.wikipedia.org/wiki/قائمة_الجامعات_السعودية"
  },
  EG: {
    code: "EG",
    name: "Egypt",
    locales: ["ar", "en"],
    currency: "EGP",
    academicYearStartsMonth: 9,
    feeTerms: [
      "المصروفات", "الرسوم", "تكاليف الدراسة", "المصاريف",
      "tuition", "fees", "tuition fees"
    ],
    admissionTerms: [
      "القبول", "شروط القبول", "التقديم", "التسجيل",
      "admission", "requirements", "apply", "registration"
    ],
    scholarshipTerms: ["منحة", "المنح", "scholarship", "منح دراسية"],
    wikiSlug: "https://ar.wikipedia.org/wiki/قائمة_الجامعات_المصرية"
  },
  AE: {
    code: "AE",
    name: "United Arab Emirates",
    locales: ["ar", "en"],
    currency: "AED",
    academicYearStartsMonth: 9,
    feeTerms: [
      "الرسوم", "الرسوم الدراسية", "التكلفة", "المصروفات",
      "tuition", "fees", "tuition fees"
    ],
    admissionTerms: [
      "القبول", "شروط القبول", "التسجيل", "التقديم",
      "admission", "requirements", "apply", "registration"
    ],
    scholarshipTerms: ["المنحة", "المنح", "scholarship"],
    wikiSlug: "https://ar.wikipedia.org/wiki/قائمة_الجامعات_في_الإمارات"
  },
  CA: {
    code: "CA",
    name: "Canada",
    locales: ["en", "fr"],
    currency: "CAD",
    academicYearStartsMonth: 9,
    feeTerms: [
      "tuition", "tuition and fees", "tuition fees", "fees", "cost of attendance",
      "cost of study", "frais de scolarité", "droits de scolarité"
    ],
    admissionTerms: [
      "admissions", "admission requirements", "how to apply", "apply",
      "conditions d'admission", "postsecondary", "admission", "requirements"
    ],
    scholarshipTerms: ["scholarship", "bursary", "awards", "bourses", "bourse", "financial aid"],
    urlHintsFee: ["tuition-fees", "/fees/", "cost-of-attendance", "/frais/"],
    urlHintsAdm: ["admissions", "admission-requirements", "how-to-apply", "conditions-admission"],
    wikiSlug: "https://en.wikipedia.org/wiki/List_of_universities_in_Canada"
  },
  AU: {
    code: "AU",
    name: "Australia",
    locales: ["en"],
    currency: "AUD",
    academicYearStartsMonth: 2,
    feeTerms: [
      "tuition", "tuition fees", "fees", "course fees",
      "international student fees", "domestic fees"
    ],
    admissionTerms: [
      "admission", "admissions", "entry requirements", "apply",
      "how to apply", "application"
    ],
    scholarshipTerms: ["scholarship", "bursary", "financial assistance"],
    wikiSlug: "https://en.wikipedia.org/wiki/List_of_universities_in_Australia"
  },
  NL: {
    code: "NL",
    name: "Netherlands",
    locales: ["nl", "en"],
    currency: "EUR",
    academicYearStartsMonth: 9,
    feeTerms: [
      "collegegeld", "institutioneel tarief", "statutair collegegeld",
      "studiekosten", "kosten", "tuition", "tuition fees", "fees"
    ],
    admissionTerms: [
      "toelatingseisen", "aanmelden", "toelating", "toelatingseis",
      "admission", "entry requirements", "requirements", "apply"
    ],
    scholarshipTerms: ["beurs", "scholarship", "financiering", "studiefinanciering"],
    urlHintsFee: ["collegegeld", "/fees/", "/tuition/", "tarief"],
    urlHintsAdm: ["toelating", "toelatingseisen", "aanmelden", "/admission", "/apply"],
    wikiSlug: "https://en.wikipedia.org/wiki/List_of_universities_in_the_Netherlands"
  },
  ES: {
    code: "ES",
    name: "Spain",
    locales: ["es", "en"],
    currency: "EUR",
    academicYearStartsMonth: 9,
    feeTerms: [
      "tasas", "precios públicos", "precio matrícula", "matrícula",
      "tuition", "fees", "tuition fees"
    ],
    admissionTerms: [
      "admisión", "requisitos de acceso", "solicitud",
      "apply", "admission", "requirements"
    ],
    scholarshipTerms: ["becas", "ayudas", "scholarship"],
    urlHintsFee: ["tasas", "precios", "/matricula", "/matr%C3%ADcula", "/fees/"],
    urlHintsAdm: ["admis", "requisitos", "acceso", "/apply", "/admission"],
    wikiSlug: "https://es.wikipedia.org/wiki/Anexo:Universidades_de_España"
  }
};

// Default fallback profile for countries not in the list
export const DEFAULT_PROFILE: CountryProfile = {
  code: "DEFAULT",
  name: "Default",
  locales: ["en", "ar"],
  currency: "USD",
  academicYearStartsMonth: 9,
  feeTerms: [
    "tuition", "tuition fees", "fees", "fee", "cost", "costs",
    "الرسوم", "المصروفات", "تكلفة"
  ],
  admissionTerms: [
    "admission", "admissions", "requirements", "apply", "application",
    "القبول", "شروط القبول", "التقديم"
  ],
  scholarshipTerms: [
    "scholarship", "financial aid", "منحة", "المنح"
  ]
};

/**
 * Get country profile by name or code
 */
export function getCountryProfile(countryNameOrCode: string): CountryProfile {
  const normalized = countryNameOrCode.trim().toUpperCase();
  
  // Try exact code match first
  if (COUNTRY_PROFILES[normalized]) {
    return COUNTRY_PROFILES[normalized];
  }
  
  // Try name match
  const byName = Object.values(COUNTRY_PROFILES).find(
    p => p.name.toUpperCase() === normalized
  );
  
  if (byName) return byName;
  
  // Fallback to default
  console.log(`[profiles] No profile found for ${countryNameOrCode}, using default`);
  return DEFAULT_PROFILE;
}

/**
 * Build regex matchers from profile terms
 */
export function buildMatchers(profile: CountryProfile) {
  const buildRe = (terms: string[]) => {
    const escaped = terms.map(t => t.replace(/\s+/g, '\\s+').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(escaped.join('|'), 'i');
  };
  
  return {
    fee: buildRe(profile.feeTerms),
    admission: buildRe(profile.admissionTerms),
    scholarship: buildRe(profile.scholarshipTerms)
  };
}

/**
 * Get currency regex for detection
 */
export function getCurrencyRegex(profile: CountryProfile): RegExp {
  const symbols: Record<string, string> = {
    USD: '\\$',
    GBP: '£',
    EUR: '€',
    SAR: 'SAR|ريال',
    AED: 'AED|درهم',
    EGP: 'EGP|جنيه',
    RUB: '₽|руб',
    TRY: '₺|TL',
    CAD: 'C\\$|CAD',
    AUD: 'A\\$|AUD'
  };
  
  const symbol = symbols[profile.currency] || profile.currency;
  return new RegExp(`(${symbol})\\s?\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2})?`, 'i');
}

/**
 * Get numeric amount regex (for amounts without clear currency)
 */
export const NUMERIC_AMOUNT_RE = /\d{3,}/;

/**
 * Detect academic year mentions in text
 */
export function detectAcademicYear(text: string): string | null {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  
  // Pattern: 2024/2025, 2024-2025, 2024/25, 2024-25
  const patterns = [
    `${currentYear}[/-]${nextYear}`,
    `${currentYear}[/-]${String(nextYear).slice(-2)}`,
    `${nextYear}[/-]${currentYear}`,
    `${currentYear}`,
    `${nextYear}`
  ];
  
  for (const pattern of patterns) {
    if (new RegExp(pattern).test(text)) {
      return `${currentYear}/${nextYear}`;
    }
  }
  
  return null;
}
