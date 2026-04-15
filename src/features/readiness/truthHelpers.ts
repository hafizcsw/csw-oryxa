/**
 * Helper to extract TruthBlockData from program/university API responses.
 * Only maps fields that are present in source truth.
 */
import type { TruthBlockData } from '@/components/readiness/AdmissionTruthBlock';
import type { DecisionBlockData } from '@/components/readiness/DecisionBlocks';
import type { RequirementTruthContext } from './types';

type LooseRecord = Record<string, unknown>;

function pickSourceStatus(hasVerifiedAtLeastOneField: boolean): 'partial' | 'unverified' {
  return hasVerifiedAtLeastOneField ? 'partial' : 'unverified';
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Normalize degree_level strings (e.g. "b.sc", "b.b.a", "MSc") to canonical route keys */
function normalizeDegreeLevel(raw: string): string {
  const lower = raw.toLowerCase().replace(/[\s._-]+/g, '');
  if (/^b/.test(lower) || /bachelor|undergraduate|licence/.test(lower)) return 'bachelor';
  if (/^m/.test(lower) || /master|postgraduate|mba/.test(lower)) return 'master';
  if (/^(phd|dphil|doctor)/.test(lower)) return 'phd';
  return 'general';
}


function toVerifiedAlternativePrograms(value: unknown): RequirementTruthContext['verified_alternative_programs'] {
  if (!Array.isArray(value)) return undefined;
  const mapped = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as LooseRecord;
      const programTitle = getString(rec.program_title) || getString(rec.title);
      if (!programTitle) return null;
      return {
        program_title: programTitle,
        program_slug: getString(rec.program_slug),
        university_name: getString(rec.university_name),
        university_slug: getString(rec.university_slug),
      };
    })
    .filter((item): item is Exclude<typeof item, null> => Boolean(item));
  return mapped.length > 0 ? mapped : undefined;
}

function toVerifiedAlternativeUniversities(value: unknown): RequirementTruthContext['verified_alternative_universities'] {
  if (!Array.isArray(value)) return undefined;
  const mapped = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as LooseRecord;
      const universityName = getString(rec.university_name) || getString(rec.name);
      if (!universityName) return null;
      return {
        university_name: universityName,
        university_slug: getString(rec.university_slug),
      };
    })
    .filter((item): item is Exclude<typeof item, null> => Boolean(item));
  return mapped.length > 0 ? mapped : undefined;
}

export function buildProgramRequirementContext(program: LooseRecord): RequirementTruthContext {
  return {
    source_status: pickSourceStatus(Boolean(
      getNumber(program?.min_gpa) != null ||
      getNumber(program?.ielts_required) != null ||
      getNumber(program?.toefl_required) != null ||
      Array.isArray(program?.prerequisite_subjects)
    )),
    min_gpa: getNumber(program?.min_gpa),
    min_ielts: getNumber(program?.ielts_required),
    min_toefl: getNumber(program?.toefl_required),
    required_subjects: toStringArray(program?.prerequisite_subjects),
    has_foundation: getBoolean(program?.foundation_available),
    has_pathway: getBoolean(program?.pathway_available),
    direct_route_available: getBoolean(program?.direct_admission_available),
    deadline: getString(program?.next_intake_date),
    intake_semesters: toStringArray(program?.intake_semesters),
    verified_alternative_programs: toVerifiedAlternativePrograms(program?.verified_alternative_programs),
    verified_alternative_universities: toVerifiedAlternativeUniversities(program?.verified_alternative_universities),
  };
}

/** Build truth block from program data returned by get-program-details */
export function buildProgramTruthData(program: LooseRecord): TruthBlockData {
  const data: TruthBlockData = {};

  const languageRequirements: TruthBlockData['language_requirements'] = [];
  const ieltsRequired = getNumber(program?.ielts_required);
  const toeflRequired = getNumber(program?.toefl_required);
  if (ieltsRequired != null) languageRequirements.push({ test: 'IELTS', min_score: ieltsRequired });
  if (toeflRequired != null) languageRequirements.push({ test: 'TOEFL', min_score: toeflRequired });
  if (languageRequirements.length > 0) data.language_requirements = languageRequirements;

  const academicRequirements: TruthBlockData['academic_requirements'] = [];
  const minGpa = getNumber(program?.min_gpa);
  if (minGpa != null) {
    academicRequirements.push({ label_key: 'truth.req.gpa', value: `${minGpa}` });
  }
  for (const cert of toStringArray(program?.accepted_certificates)) {
    academicRequirements.push({ label_key: 'truth.accepted_certificate', value: cert });
  }
  if (academicRequirements.length > 0) data.academic_requirements = academicRequirements;

  const routes: TruthBlockData['routes'] = [];
  const direct = getBoolean(program?.direct_admission_available);
  const foundation = getBoolean(program?.foundation_available);
  const pathway = getBoolean(program?.pathway_available);

  if (direct != null) {
    routes.push({ type: 'direct', label_key: 'truth.route.direct', available: direct, requirements: [] });
  }
  if (foundation != null) {
    routes.push({ type: 'foundation', label_key: 'truth.route.foundation', available: foundation, requirements: [] });
  }
  if (pathway != null) {
    routes.push({ type: 'pathway', label_key: 'truth.route.pathway', available: pathway, requirements: [] });
  }
  if (routes.length > 0) data.routes = routes;

  const deadlines: TruthBlockData['deadlines'] = [];
  const nextIntake = getString(program?.next_intake);
  const nextIntakeDate = getString(program?.next_intake_date);
  if (nextIntake || nextIntakeDate) {
    const status: 'open' | 'closed' | 'upcoming' = (() => {
      if (!nextIntakeDate) return 'upcoming';
      return new Date(nextIntakeDate).getTime() < Date.now() ? 'closed' : 'open';
    })();
    deadlines.push({ intake: nextIntake || String(nextIntakeDate), deadline: nextIntakeDate || null, status });
  }
  if (deadlines.length > 0) data.deadlines = deadlines;

  const prerequisiteSubjects = toStringArray(program?.prerequisite_subjects);
  if (prerequisiteSubjects.length > 0) data.prerequisite_subjects = prerequisiteSubjects;

  const requiredDocs = toStringArray(program?.required_documents);
  if (requiredDocs.length > 0) data.required_documents = requiredDocs;

  const steps = toStringArray(program?.application_steps);
  if (steps.length > 0) data.application_steps = steps;

  const verifiedAt = getString(program?.verified_at);
  if (verifiedAt) data.last_verified = verifiedAt;

  const hasTruth = Boolean(
    data.language_requirements?.length ||
    data.academic_requirements?.length ||
    data.routes?.length ||
    data.deadlines?.length ||
    data.prerequisite_subjects?.length ||
    data.required_documents?.length ||
    data.application_steps?.length ||
    data.last_verified
  );

  data.source_status = pickSourceStatus(hasTruth);
  return data;
}

export function buildUniversityRequirementContext(admissions: LooseRecord[]): RequirementTruthContext {
  const rows = Array.isArray(admissions) ? admissions : [];
  const minGpaValues = rows.map((a) => getNumber(a?.consensus_min_gpa)).filter((v): v is number => v != null);
  const minIeltsValues = rows.map((a) => getNumber(a?.consensus_min_ielts)).filter((v): v is number => v != null);
  const minToeflValues = rows.map((a) => getNumber(a?.consensus_min_toefl)).filter((v): v is number => v != null);

  const hasTruth = minGpaValues.length > 0 || minIeltsValues.length > 0 || minToeflValues.length > 0;

  return {
    source_status: pickSourceStatus(hasTruth),
    min_gpa: minGpaValues.length > 0 ? Math.min(...minGpaValues) : undefined,
    min_ielts: minIeltsValues.length > 0 ? Math.min(...minIeltsValues) : undefined,
    min_toefl: minToeflValues.length > 0 ? Math.min(...minToeflValues) : undefined,
  };
}

/** Build truth block from university data (admissions_consensus) */
export function buildUniversityTruthData(item: LooseRecord | null | undefined, admissions: LooseRecord[]): TruthBlockData {
  const data: TruthBlockData = {};

  if (Array.isArray(admissions) && admissions.length > 0) {
    // Deduplicate by normalized degree level, keeping the first (highest-confidence) entry
    const seenLevels = new Set<string>();
    data.routes = admissions
      .filter((adm) => getString(adm?.degree_level))
      .reduce<TruthBlockData['routes'] & Array<any>>((acc, adm) => {
        const normalized = normalizeDegreeLevel(String(adm.degree_level));
        if (seenLevels.has(normalized)) return acc;
        seenLevels.add(normalized);
        acc.push({
          type: 'direct' as const,
          label_key: `truth.route.direct_${normalized}`,
          available: getBoolean(adm?.direct_admission_available),
          requirements: [
            ...(getNumber(adm?.consensus_min_gpa) != null ? [{ label_key: 'truth.req.gpa', value: `${getNumber(adm?.consensus_min_gpa)}` }] : []),
            ...(getNumber(adm?.consensus_min_ielts) != null ? [{ label_key: 'truth.req.ielts', value: `${getNumber(adm?.consensus_min_ielts)}` }] : []),
            ...(getNumber(adm?.consensus_min_toefl) != null ? [{ label_key: 'truth.req.toefl', value: `${getNumber(adm?.consensus_min_toefl)}` }] : []),
          ],
        });
        return acc;
      }, []);

    const langReqs: TruthBlockData['language_requirements'] = [];
    const seenTests = new Set<string>();
    for (const adm of admissions) {
      const minIelts = getNumber(adm?.consensus_min_ielts);
      const minToefl = getNumber(adm?.consensus_min_toefl);
      if (minIelts != null && !seenTests.has('IELTS')) {
        langReqs.push({ test: 'IELTS', min_score: minIelts });
        seenTests.add('IELTS');
      }
      if (minToefl != null && !seenTests.has('TOEFL')) {
        langReqs.push({ test: 'TOEFL', min_score: minToefl });
        seenTests.add('TOEFL');
      }
    }
    if (langReqs.length > 0) data.language_requirements = langReqs;
  }

  if (item?.has_dorm != null) {
    data.housing = {
      available: Boolean(item.has_dorm),
      cost_monthly: getNumber(item.dorm_price_monthly_local) ?? null,
      currency: getString(item.currency_code),
    };
  }

  const verifiedAt = getString(item?.verified_at);
  if (verifiedAt) data.last_verified = verifiedAt;

  const hasTruth = Boolean(
    data.routes?.length ||
    data.language_requirements?.length ||
    data.housing ||
    data.last_verified
  );
  data.source_status = pickSourceStatus(hasTruth);

  return data;
}

/** Build decision blocks from program data */
export function buildProgramDecisionData(program: LooseRecord): DecisionBlockData {
  const data: DecisionBlockData = {};

  const tuition = getNumber(program.fees_yearly);
  const living = getNumber(program.monthly_living);
  if (tuition != null || living != null) {
    const currency = getString(program.currency_code) || 'USD';
    data.cost = {
      tuition_yearly: tuition,
      living_monthly: living,
      currency,
      total_estimated_yearly: tuition != null && living != null ? tuition + (living * 12) : tuition ?? null,
    };
  }

  const nextIntakeDate = getString(program.next_intake_date);
  const nextIntake = getString(program.next_intake);
  if (nextIntakeDate || nextIntake) {
    const deadline = nextIntakeDate ? new Date(nextIntakeDate) : null;
    let daysRemaining: number | null = null;
    let status: 'open' | 'closing_soon' | 'closed' | 'upcoming' = 'upcoming';

    if (deadline) {
      daysRemaining = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) status = 'closed';
      else if (daysRemaining < 30) status = 'closing_soon';
      else status = 'open';
    }

    data.deadlines = [{
      intake: nextIntake || String(nextIntakeDate),
      deadline: nextIntakeDate || null,
      days_remaining: daysRemaining,
      status,
    }];
  }

  const scholarshipsRaw = Array.isArray(program?.scholarships) ? (program.scholarships as LooseRecord[]) : [];
  if (scholarshipsRaw.length > 0) {
    data.scholarships = scholarshipsRaw
      .filter((s) => getString(s?.name) || getString(s?.title))
      .map((s) => ({
        name: getString(s.name) || getString(s.title) || '',
        amount: getString(s.amount) || null,
        type: getString(s.type) || null,
        deadline: getString(s.deadline) || null,
        eligibility: getString(s.eligibility) || null,
      }));
  }

  const housingMonthly = getNumber(program?.dorm_price_monthly_local);
  if (housingMonthly != null) {
    data.housing_monthly = housingMonthly;
    data.housing_currency = getString(program.currency_code) || 'USD';
  }

  return data;
}
