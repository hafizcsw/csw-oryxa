import type { StudentPortalProfile } from "@/hooks/useStudentProfile";
import type { StudentDocument } from "@/hooks/useStudentDocuments";

/**
 * Calculate profile completion progress based on filled fields and uploaded documents
 * Fields: 80% (10 fields × 8% each)
 * Documents: 20% (passport 15% + photo 5%)
 */
export function calculateProfileProgress(
  profile: StudentPortalProfile | null,
  documents: StudentDocument[]
): number {
  if (!profile) return 0;
  
  let score = 0;
  
  // Essential profile fields (80% total, 8% each)
  const fields: (keyof StudentPortalProfile)[] = [
    'full_name',
    'gender', 
    'birth_year',
    'citizenship',
    'country',
    'preferred_major',
    'preferred_degree_level',
    'budget_usd',
    'language_preference',
    'phone'
  ];
  
  const fieldWeight = 8;
  fields.forEach(field => {
    const value = profile[field];
    if (value !== null && value !== undefined && value !== '') {
      score += fieldWeight;
    }
  });
  
  // Documents (20% total)
  const hasPassport = documents.some(d => 
    d.document_category === 'passport' || d.file_type?.includes('passport')
  );
  const hasPhoto = documents.some(d => 
    d.document_category === 'photo' || d.document_category === 'personal_photo'
  );
  
  if (hasPassport) score += 15;
  if (hasPhoto) score += 5;
  
  return Math.min(score, 100);
}
