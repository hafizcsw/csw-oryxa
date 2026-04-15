import { ProgramCard, ProgramCardData } from '@/components/ProgramCard';

interface ChatProgramCardProps {
  program: {
    program_id: string;
    university_id?: string;
    program_name: string;
    university_name: string;
    country_name: string;
    country_slug?: string;
    city?: string | null;
    currency_code?: string;
    fees_yearly?: number | null;
    duration_months?: number | null;
    language?: string | null;
    logo_url?: string | null;
    degree_name?: string | null;
    study_mode?: string | null;
    has_dorm?: boolean | null;
    scholarship_available?: boolean | null;
    ranking_global?: number | null;
  };
  onDetails: (programId: string) => void;
  onFavoriteClick: () => void;
  isFavorite: boolean;
}

/**
 * ChatProgramCard - Wrapper around unified ProgramCard for chat results
 */
export function ChatProgramCard({ program }: ChatProgramCardProps) {
  const cardData: ProgramCardData = {
    program_id: program.program_id,
    program_name: program.program_name,
    program_name_ar: (program as any).program_name_ar,
    program_name_en: (program as any).program_name_en,
    university_id: program.university_id,
    university_name: program.university_name,
    university_name_ar: (program as any).university_name_ar,
    university_name_en: (program as any).university_name_en,
    country_name: program.country_name,
    country_name_ar: (program as any).country_name_ar,
    country_name_en: (program as any).country_name_en,
    country_slug: program.country_slug,
    city: program.city,
    currency_code: program.currency_code,
    fees_yearly: program.fees_yearly,
    duration_months: program.duration_months,
    language: program.language,
    logo_url: program.logo_url,
    degree_name: program.degree_name,
    study_mode: program.study_mode,
    has_dorm: program.has_dorm,
    scholarship_available: program.scholarship_available,
  };

  return <ProgramCard p={cardData} />;
}
