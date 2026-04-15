import { describe, expect, it } from 'vitest';
import { buildCardsQueryPayload } from '../cardsQueryPayload';

describe('buildCardsQueryPayload', () => {
  it('keeps only HARD16, RANK10 and keyword', () => {
    const payload = buildCardsQueryPayload({
      params: {
        country_code: 'TR',
        keyword: 'engineering',
        query: 'blocked alias',
        unknown_key: 'x',
      },
      rank_filters: {
        institution_id: 'uni-1',
        random_rank: 10,
      },
      filters_hash: 'hash123',
    });

    expect(payload).toEqual({
      params: {
        country_code: 'TR',
        keyword: 'engineering',
      },
      rank_filters: {
        institution_id: 'uni-1',
      },
      filters_hash: 'hash123',
    });
  });

  it('keeps multiple canonical Hard16 filters for structured payloads', () => {
    const payload = buildCardsQueryPayload({
      params: {
        country_code: 'EG',
        city: 'Cairo',
        degree_slug: 'bachelor',
        discipline_slug: 'computer-science',
        study_mode: 'onsite',
        instruction_languages: ['en', 'ar'],
        tuition_usd_min: 1000,
        tuition_usd_max: 6000,
        duration_months_max: 48,
        has_dorm: true,
        dorm_price_monthly_usd_max: 300,
        monthly_living_usd_max: 500,
        scholarship_available: true,
        scholarship_type: 'partial',
        intake_months: ['sep', 'jan'],
        deadline_before: '2026-11-01',
        keyword: 'ai',
      },
      rank_filters: {
        institution_id: 'uni-1',
        world_rank_max: 500,
      },
    });

    expect(payload.params).toMatchObject({
      country_code: 'EG',
      city: 'Cairo',
      degree_slug: 'bachelor',
      discipline_slug: 'computer-science',
      study_mode: 'onsite',
      tuition_usd_min: 1000,
      tuition_usd_max: 6000,
      duration_months_max: 48,
      has_dorm: true,
      dorm_price_monthly_usd_max: 300,
      monthly_living_usd_max: 500,
      scholarship_available: true,
      scholarship_type: 'partial',
      deadline_before: '2026-11-01',
      keyword: 'ai',
    });
    expect(payload.params.instruction_languages).toEqual(['en', 'ar']);
    expect(payload.params.intake_months).toEqual(['sep', 'jan']);
    expect(payload.rank_filters).toEqual({ institution_id: 'uni-1', world_rank_max: 500 });
  });

  it('does not emit empty rank_filters', () => {
    const payload = buildCardsQueryPayload({
      params: { country_code: 'TR' },
      rank_filters: { unknown_rank: 1 },
    });

    expect(payload).toEqual({
      params: { country_code: 'TR' },
    });
  });
});
