import { describe, expect, it } from 'vitest';
import {
  parseFilterTokensFromText,
  shouldAttachClarifyFilters,
  shouldShowEmptyResponseFallback,
} from '../clarify';

describe('shouldShowEmptyResponseFallback', () => {
  it('does not fallback when reply is empty but reply_key exists', () => {
    const shouldFallback = shouldShowEmptyResponseFallback({
      payload: { reply: '', reply_key: 'search.clarify.country' },
      rawMessageCount: 1,
      incomingMessageCount: 0,
    });

    expect(shouldFallback).toBe(false);
  });

  it('does not fallback when reply is empty but phase exists', () => {
    const shouldFallback = shouldShowEmptyResponseFallback({
      payload: { reply: '', phase: 'clarify' },
      rawMessageCount: 1,
      incomingMessageCount: 0,
    });

    expect(shouldFallback).toBe(false);
  });
});

describe('parseFilterTokensFromText', () => {
  it('extracts typed filters from explicit tokens', () => {
    const filters = parseFilterTokensFromText(
      [
        'country_code=de',
        'city=Berlin',
        'study_mode=Full_Time',
        'tuition_usd_max=12000.5',
        'duration_months_max=24',
        'has_dorm=yes',
        'scholarship_available=0',
        'intake_months=10,3,13,0',
        'instruction_languages=EN,de',
        'ranking_system=QS',
        'ranking_year=2024',
        'world_rank_max=500',
        'deadline_before=2026-09-01',
      ].join(' ')
    );

    expect(filters).toEqual({
      country_code: 'DE',
      city: 'berlin',
      study_mode: 'full_time',
      tuition_usd_max: 12000.5,
      duration_months_max: 24,
      has_dorm: true,
      scholarship_available: false,
      intake_months: [10, 3],
      instruction_languages: ['en', 'de'],
      ranking_system: 'qs',
      ranking_year: 2024,
      world_rank_max: 500,
      deadline_before: '2026-09-01',
    });
  });

  it('enforces strict country_code format', () => {
    const valid = parseFilterTokensFromText('country_code=de');
    const invalidLong = parseFilterTokensFromText('country_code=Germany');
    const invalidAlnum = parseFilterTokensFromText('country_code=DE1');

    expect(valid).toEqual({ country_code: 'DE' });
    expect(invalidLong).toEqual({});
    expect(invalidAlnum).toEqual({});
  });

  it('ignores forbidden aliases and locked keys', () => {
    const filters = parseFilterTokensFromText(
      'q=medicine query=test keyword=foo tuition_basis=year is_active=true country_code=TR'
    );

    expect(filters).toEqual({ country_code: 'TR' });
  });

  it('rejects negative and out-of-range numeric values', () => {
    const filters = parseFilterTokensFromText('tuition_usd_max=-5 ranking_year=2200');
    expect(filters).toEqual({});
  });

  it('rejects invalid slug format', () => {
    const filters = parseFilterTokensFromText('discipline_slug=Computer$Science degree_slug=bachelor-degree');
    expect(filters).toEqual({ degree_slug: 'bachelor-degree' });
  });

  it('ignores unknown and invalid values', () => {
    const filters = parseFilterTokensFromText(
      [
        'unknown_key=value',
        'tuition_usd_min=abc',
        'has_dorm=maybe',
        'intake_months=0,13',
        'deadline_before=01-09-2026',
        'ranking_year=2024x',
        'institution_id=',
      ].join(' ')
    );

    expect(filters).toEqual({});
  });
});

describe('shouldAttachClarifyFilters', () => {
  it('auto-attaches session filters when chat is in hold/clarify flow', () => {
    const result = shouldAttachClarifyFilters({
      hasExplicitFilters: false,
      sessionFilters: { country_code: 'DE' },
      isAwaitingConsent: false,
      isHoldState: true,
    });

    expect(result).toBe(true);
  });

  it('does not auto-attach without hold/consent and no explicit filters', () => {
    const result = shouldAttachClarifyFilters({
      hasExplicitFilters: false,
      sessionFilters: { country_code: 'DE' },
      isAwaitingConsent: false,
      isHoldState: false,
    });

    expect(result).toBe(false);
  });
});
