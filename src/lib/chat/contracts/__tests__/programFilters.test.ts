import { describe, expect, it } from 'vitest';
import { sanitizeProgramFilters } from '../programFilters';

describe('sanitizeProgramFilters', () => {
  it('keeps only contract keys and rejects keyword aliases', () => {
    const result = sanitizeProgramFilters({
      params: {
        country_code: 'TR',
        q: 'engineering',
        unknown: 'x',
        tuition_basis: 'year',
      },
      rank_filters: {
        institution_id: 'abc',
        random_rank: 1,
      },
    });

    expect(result.params).toEqual({
      country_code: 'TR',
    });
    expect(result.rank_filters).toEqual({ institution_id: 'abc' });
    expect(result.invalidKeys).toEqual(['blocked_alias:q', 'unknown', 'tuition_basis', 'rank:random_rank']);
  });

  it('keeps canonical Hard16 + keyword entries for structured payloads', () => {
    const result = sanitizeProgramFilters({
      params: {
        country_code: 'EG',
        city: 'Cairo',
        degree_slug: 'master',
        discipline_slug: 'business',
        study_mode: 'online',
        instruction_languages: ['en'],
        tuition_usd_min: 3000,
        tuition_usd_max: 9000,
        duration_months_max: 24,
        has_dorm: false,
        dorm_price_monthly_usd_max: 400,
        monthly_living_usd_max: 700,
        scholarship_available: true,
        scholarship_type: 'full',
        intake_months: ['jan'],
        deadline_before: '2026-06-01',
        keyword: 'mba',
      },
      rank_filters: {
        institution_id: 'uni-9',
        world_rank_max: 250,
      },
    });

    expect(result.invalidKeys).toEqual([]);
    expect(result.params).toMatchObject({
      country_code: 'EG',
      city: 'Cairo',
      degree_slug: 'master',
      discipline_slug: 'business',
      study_mode: 'online',
      tuition_usd_min: 3000,
      tuition_usd_max: 9000,
      duration_months_max: 24,
      has_dorm: false,
      dorm_price_monthly_usd_max: 400,
      monthly_living_usd_max: 700,
      scholarship_available: true,
      scholarship_type: 'full',
      deadline_before: '2026-06-01',
      keyword: 'mba',
    });
    expect(result.params.instruction_languages).toEqual(['en']);
    expect(result.params.intake_months).toEqual(['jan']);
    expect(result.rank_filters).toEqual({ institution_id: 'uni-9', world_rank_max: 250 });
  });

  it('returns empty rank_filters when no valid rank key exists', () => {
    const result = sanitizeProgramFilters({
      params: { keyword: 'mba' },
      rank_filters: { bogus: true },
    });

    expect(result.rank_filters).toBeUndefined();
    expect(result.params).toEqual({ keyword: 'mba' });
    expect(result.invalidKeys).toEqual(['rank:bogus']);
  });
});
