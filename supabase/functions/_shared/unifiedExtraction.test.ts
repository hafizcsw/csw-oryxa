import { describe, expect, it } from 'vitest';
import { computeProgramKey, enforceEvidenceGuard, extractProgramsRegex } from './unifiedExtraction';

const fixtures = {
  table5: `| Program | Degree | Duration | Tuition | Language |\n|---|---|---|---|---|\n| Computer Science | Bachelor | 4 years | USD 12000 / year | English |`,
  table4: `| Program | Degree | Tuition | Language |\n|---|---|---|---|\n| Data Science | Master | USD 25000 / semester | English |`,
  bullets: `- MBA in International Business\n- MSc in Finance`,
  headings: `## Undergraduate Programs\n### Civil Engineering\nProgram duration is 48 months and tuition is USD 10000 per year.`,
};

describe('unified extraction fixtures', () => {
  it('extracts at least one program from all non-empty fixtures (table/bullets/headings)', () => {
    for (const [name, text] of Object.entries(fixtures)) {
      const programs = extractProgramsRegex(text, 'https://example.edu/programs', `${name}-hash`);
      expect(programs.length).toBeGreaterThan(0);
      for (const p of programs) {
        expect(p.name.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('evidence guard nulls sensitive fields without quote', () => {
    const [program] = extractProgramsRegex(fixtures.table5, 'https://example.edu/programs', 'hash');
    program.requirements.ielts_min_overall = 6.5;
    program.evidence['requirements.ielts_min_overall'] = { quote: 'IELTS 6.5' };

    const result = enforceEvidenceGuard(program, fixtures.table5);
    expect(result.program.requirements.ielts_min_overall).toBeNull();
    expect(result.rejections).toContain('evidence_not_found:requirements.ielts_min_overall');
  });

  it('program_key is stable and dedupe-safe', async () => {
    const key1 = await computeProgramKey('https://EXAMPLE.edu/programs', ' MBA ', 'Master');
    const key2 = await computeProgramKey('https://example.edu/programs', 'mba', 'master');
    const key3 = await computeProgramKey('https://example.edu/programs', 'mba', 'phd');
    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });
  it('maps 4-column headers correctly (tuition stays tuition)', () => {
    const [program] = extractProgramsRegex(fixtures.table4, 'https://example.edu/programs', 'table4-hash');
    expect(program.tuition.usd_min).toBe(25000);
    expect(program.duration.months).toBeNull();
  });
});
