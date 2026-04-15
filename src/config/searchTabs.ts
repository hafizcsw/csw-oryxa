/**
 * ============= Website Filter Contract v1 =============
 * Programs tab uses ONLY 5 filters:
 * - country_slug → country_code
 * - degree_id → degree_level  
 * - subject → keyword
 * - language → instruction_languages
 * - fees_max → max_tuition (annual USD)
 * 
 * All other filters are CLOSED until End-to-End verification.
 */

export type FilterFieldType = 
  | "select:countries"
  | "select:degrees"
  | "select:subjects"
  | "select:disciplines"
  | "select:languages"
  | "select:certificates"
  | "select:events_type"
  | "select:sort_universities"
  | "select:boolean_yesno"
  | "select:university_type"
  | "number"
  | "date"
  | "text";

export interface FilterField {
  key: string;
  type: FilterFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface TabConfig {
  label: string;
  endpoint: string;
  fields: FilterField[];
  emptyStateText: string;
  isReady: boolean;
}

// ============= i18n Translation Keys for Tabs =============
// Labels and placeholders use translation keys instead of hardcoded Arabic
// ============= Shared filter fields across Programs, Scholarships, Universities =============
const SHARED_FILTER_FIELDS: FilterField[] = [
  { 
    key: "country_slug", 
    type: "select:countries", 
    label: "tabs.filters.destination",
    placeholder: "tabs.filters.allCountries"
  },
  { 
    key: "q_name", 
    type: "text", 
    label: "tabs.filters.universityName",
    placeholder: "tabs.filters.searchUniversity"
  },
  { 
    key: "degree_id", 
    type: "select:degrees", 
    label: "tabs.filters.degree",
    placeholder: "tabs.filters.allDegrees"
  },
  { 
    key: "discipline_slug", 
    type: "select:disciplines", 
    label: "tabs.filters.discipline",
    placeholder: "tabs.filters.allDisciplines"
  },
  { 
    key: "fees_min", 
    type: "number", 
    label: "tabs.filters.minFees",
    placeholder: "tabs.filters.feesMinExample"
  },
  { 
    key: "fees_max", 
    type: "number", 
    label: "tabs.filters.annualBudget",
    placeholder: "tabs.filters.budgetExample"
  },
  { 
    key: "living_min", 
    type: "number", 
    label: "tabs.filters.minLiving",
    placeholder: "tabs.filters.livingMinExample"
  },
  { 
    key: "living_max", 
    type: "number", 
    label: "tabs.filters.maxLiving",
    placeholder: "tabs.filters.livingMaxExample"
  },
  { 
    key: "has_dorm", 
    type: "select:boolean_yesno", 
    label: "tabs.filters.hasDorm",
    placeholder: "tabs.filters.allDormOptions"
  },
  { 
    key: "university_type", 
    type: "select:university_type", 
    label: "tabs.filters.universityType",
    placeholder: "tabs.filters.allUniversityTypes"
  },
  { 
    key: "rank_max", 
    type: "number", 
    label: "tabs.filters.rankMax",
    placeholder: "tabs.filters.rankMaxExample"
  },
  { 
    key: "sort", 
    type: "select:sort_universities", 
    label: "tabs.filters.sortResults"
  }
];

export const SEARCH_TABS: Record<string, TabConfig> = {
  programs: {
    label: "tabs.programs.label",
    endpoint: "/search-programs",
    isReady: true,
    emptyStateText: "tabs.programs.empty",
    fields: [...SHARED_FILTER_FIELDS]
  },
  scholarships: {
    label: "tabs.scholarships.label",
    endpoint: "/search-scholarships",
    isReady: true,
    emptyStateText: "tabs.scholarships.empty",
    fields: [...SHARED_FILTER_FIELDS]
  },
  universities: {
    label: "tabs.universities.label",
    endpoint: "/search-universities",
    isReady: true,
    emptyStateText: "tabs.universities.empty",
    fields: [...SHARED_FILTER_FIELDS]
  },
  events: {
    label: "tabs.events.label",
    endpoint: "/search-events",
    isReady: true,
    emptyStateText: "tabs.events.empty",
    fields: [
      { 
        key: "country_slug", 
        type: "select:countries", 
        label: "tabs.filters.country",
        placeholder: "tabs.filters.allCountries"
      },
      { 
        key: "type", 
        type: "select:events_type", 
        label: "tabs.filters.eventType",
        placeholder: "tabs.filters.allTypes"
      },
      { 
        key: "date_from", 
        type: "date", 
        label: "tabs.filters.dateFrom"
      },
      { 
        key: "date_to", 
        type: "date", 
        label: "tabs.filters.dateTo"
      }
    ]
  }
};

export type TabKey = keyof typeof SEARCH_TABS;

export const DEFAULT_TAB: TabKey = "programs";

// ============= Static Options (use translation keys) =============
export const SUBJECTS_OPTIONS = [
  { id: "business", slug: "business", nameKey: "options.subjects.business" },
  { id: "engineering", slug: "engineering", nameKey: "options.subjects.engineering" },
  { id: "medicine", slug: "medicine", nameKey: "options.subjects.medicine" },
  { id: "it", slug: "it", nameKey: "options.subjects.it" },
  { id: "arts", slug: "arts", nameKey: "options.subjects.arts" },
  { id: "science", slug: "science", nameKey: "options.subjects.science" },
  { id: "law", slug: "law", nameKey: "options.subjects.law" },
  { id: "education", slug: "education", nameKey: "options.subjects.education" },
];

export const LANGUAGES_OPTIONS = [
  { id: "en", code: "EN", nameKey: "options.languages.english" },
  { id: "ar", code: "AR", nameKey: "options.languages.arabic" },
  { id: "de", code: "DE", nameKey: "options.languages.german" },
  { id: "tr", code: "TR", nameKey: "options.languages.turkish" },
  { id: "ru", code: "RU", nameKey: "options.languages.russian" },
  { id: "fr", code: "FR", nameKey: "options.languages.french" },
];

export const EVENTS_TYPE_OPTIONS = [
  { id: "online", nameKey: "options.eventTypes.online" },
  { id: "in-person", nameKey: "options.eventTypes.inPerson" },
  { id: "hybrid", nameKey: "options.eventTypes.hybrid" }
];

export const SORT_OPTIONS = [
  { value: "popularity", labelKey: "options.sort.popularity" },
  { value: "rank_asc", labelKey: "options.sort.rankAsc" },
  { value: "fees_asc", labelKey: "options.sort.feesAsc" },
  { value: "fees_desc", labelKey: "options.sort.feesDesc" },
  { value: "name_asc", labelKey: "options.sort.nameAsc" },
];

export const UNIVERSITY_TYPE_OPTIONS = [
  { value: "public", labelKey: "options.universityType.public" },
  { value: "private", labelKey: "options.universityType.private" },
  { value: "foundation", labelKey: "options.universityType.foundation" },
];

export const BOOLEAN_YESNO_OPTIONS = [
  { value: "true", labelKey: "options.yesNo.yes" },
  { value: "false", labelKey: "options.yesNo.no" },
];
