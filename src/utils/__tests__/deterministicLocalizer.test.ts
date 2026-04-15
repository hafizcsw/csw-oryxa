import { describe, it, expect } from 'vitest';
import { buildGlossaryMap, localizeTitle, type GlossaryEntry } from '@/utils/deterministicLocalizer';

// Simulated glossary matching what we seeded in DB
const GLOSSARY: GlossaryEntry[] = [
  // Disciplines
  { source_text: 'Accounting', target_text: 'المحاسبة' },
  { source_text: 'Aerospace Engineering', target_text: 'هندسة الفضاء' },
  { source_text: 'Agriculture', target_text: 'الزراعة' },
  { source_text: 'Animation', target_text: 'الرسوم المتحركة' },
  { source_text: 'Archaeology', target_text: 'علم الآثار' },
  { source_text: 'Architecture', target_text: 'العمارة' },
  { source_text: 'Biology', target_text: 'الأحياء' },
  { source_text: 'Biotechnology', target_text: 'التكنولوجيا الحيوية' },
  { source_text: 'Business', target_text: 'إدارة الأعمال' },
  { source_text: 'Business Administration', target_text: 'إدارة الأعمال' },
  { source_text: 'Chemistry', target_text: 'الكيمياء' },
  { source_text: 'Civil Engineering', target_text: 'الهندسة المدنية' },
  { source_text: 'Communication', target_text: 'الاتصال' },
  { source_text: 'Computer Engineering', target_text: 'هندسة الحاسوب' },
  { source_text: 'Computer Science', target_text: 'علوم الحاسوب' },
  { source_text: 'Criminal Justice', target_text: 'العدالة الجنائية' },
  { source_text: 'Cybersecurity', target_text: 'الأمن السيبراني' },
  { source_text: 'Data Science', target_text: 'علم البيانات' },
  { source_text: 'Dentistry', target_text: 'طب الأسنان' },
  { source_text: 'Design', target_text: 'التصميم' },
  { source_text: 'Economics', target_text: 'الاقتصاد' },
  { source_text: 'Education', target_text: 'التربية' },
  { source_text: 'Electrical Engineering', target_text: 'الهندسة الكهربائية' },
  { source_text: 'Engineering', target_text: 'الهندسة' },
  { source_text: 'English', target_text: 'اللغة الإنجليزية' },
  { source_text: 'Environmental Science', target_text: 'العلوم البيئية' },
  { source_text: 'Fashion', target_text: 'الأزياء' },
  { source_text: 'Film', target_text: 'السينما' },
  { source_text: 'Finance', target_text: 'التمويل' },
  { source_text: 'Fine Arts', target_text: 'الفنون الجميلة' },
  { source_text: 'Geography', target_text: 'الجغرافيا' },
  { source_text: 'Geology', target_text: 'الجيولوجيا' },
  { source_text: 'Graphic Design', target_text: 'التصميم الجرافيكي' },
  { source_text: 'Health Sciences', target_text: 'العلوم الصحية' },
  { source_text: 'History', target_text: 'التاريخ' },
  { source_text: 'Hospitality', target_text: 'الضيافة' },
  { source_text: 'Human Resources', target_text: 'الموارد البشرية' },
  { source_text: 'Information Systems', target_text: 'نظم المعلومات' },
  { source_text: 'Information Technology', target_text: 'تقنية المعلومات' },
  { source_text: 'International Relations', target_text: 'العلاقات الدولية' },
  { source_text: 'Journalism', target_text: 'الصحافة' },
  { source_text: 'Law', target_text: 'القانون' },
  { source_text: 'Linguistics', target_text: 'اللسانيات' },
  { source_text: 'Management', target_text: 'الإدارة' },
  { source_text: 'Marketing', target_text: 'التسويق' },
  { source_text: 'Mathematics', target_text: 'الرياضيات' },
  { source_text: 'Mechanical Engineering', target_text: 'الهندسة الميكانيكية' },
  { source_text: 'Medicine', target_text: 'الطب' },
  { source_text: 'Music', target_text: 'الموسيقى' },
  { source_text: 'Nursing', target_text: 'التمريض' },
  { source_text: 'Nutrition', target_text: 'التغذية' },
  { source_text: 'Pharmacy', target_text: 'الصيدلة' },
  { source_text: 'Philosophy', target_text: 'الفلسفة' },
  { source_text: 'Physics', target_text: 'الفيزياء' },
  { source_text: 'Political Science', target_text: 'العلوم السياسية' },
  { source_text: 'Psychology', target_text: 'علم النفس' },
  { source_text: 'Public Health', target_text: 'الصحة العامة' },
  { source_text: 'Sociology', target_text: 'علم الاجتماع' },
  { source_text: 'Software Engineering', target_text: 'هندسة البرمجيات' },
  { source_text: 'Statistics', target_text: 'الإحصاء' },
  { source_text: 'Tourism', target_text: 'السياحة' },
  { source_text: 'Veterinary', target_text: 'الطب البيطري' },
  // Modifiers
  { source_text: 'Applied', target_text: 'التطبيقية' },
  { source_text: 'Clinical', target_text: 'السريرية' },
  { source_text: 'Digital', target_text: 'الرقمية' },
  { source_text: 'International', target_text: 'الدولية' },
  { source_text: 'Sciences', target_text: 'العلوم' },
  { source_text: 'Studies', target_text: 'الدراسات' },
  { source_text: 'Technology', target_text: 'التكنولوجيا' },
  // Structural
  { source_text: "Bachelor's", target_text: 'البكالوريوس' },
  { source_text: "Master's", target_text: 'الماجستير' },
  { source_text: 'PhD', target_text: 'الدكتوراه', preserve_rule: 'preserve' },
  { source_text: 'Online', target_text: 'عن بعد' },
  { source_text: 'Blended', target_text: 'مدمج' },
];

const glossaryMap = buildGlossaryMap(GLOSSARY);

// ===== QA SAMPLE: 50 real program titles =====
const QA_SAMPLE: Array<{
  title: string;
  expectedVerdict: 'PASS' | 'NEEDS_FIX' | 'BLOCKED';
  expectedLevel: 'HIGH' | 'LOW';
}> = [
  // EXACT MATCH — single discipline word
  { title: 'Accounting', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Chemistry', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Biology', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Physics', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Mathematics', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Economics', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'History', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Philosophy', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Psychology', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Sociology', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Law', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Medicine', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Nursing', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Pharmacy', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Dentistry', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },

  // MULTI-WORD PHRASES
  { title: 'Computer Science', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Civil Engineering', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Electrical Engineering', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Mechanical Engineering', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Software Engineering', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Business Administration', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Data Science', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Information Technology', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'International Relations', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Political Science', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Public Health', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Graphic Design', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Fine Arts', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Health Sciences', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Environmental Science', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },

  // WITH NOISE — degree prefix stripped
  { title: '(Hons) Computer Science', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: '(Hons) Business Management', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: '(Hons) Accounting', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: '(Hons) Graphic Design', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },

  // COMPOSITE — modifier + discipline
  { title: 'Applied Mathematics', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Clinical Psychology', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'International Business', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },

  // BLOCKED — no glossary match expected
  { title: 'Acoustics', expectedVerdict: 'BLOCKED', expectedLevel: 'LOW' },
  { title: 'Fire Safety', expectedVerdict: 'BLOCKED', expectedLevel: 'LOW' },
  { title: 'Condensed State Physics', expectedVerdict: 'BLOCKED', expectedLevel: 'LOW' }, // "Physics" matches but too small vs total
  { title: 'Welding, related processes and technologies', expectedVerdict: 'BLOCKED', expectedLevel: 'LOW' },
  { title: 'Ground Transport and Technological Means and Complexes', expectedVerdict: 'BLOCKED', expectedLevel: 'LOW' },
  { title: 'Nanotechnologies and Nanomaterials', expectedVerdict: 'BLOCKED', expectedLevel: 'LOW' },
  { title: 'Electronic component base of micro- and nanoelectronics, quantum devices', expectedVerdict: 'BLOCKED', expectedLevel: 'LOW' },
  { title: 'Life Cycle Management of Construction Objects', expectedVerdict: 'BLOCKED', expectedLevel: 'LOW' },
  { title: 'Radio engineering, including television systems and devices', expectedVerdict: 'BLOCKED', expectedLevel: 'LOW' },

  // PARTIAL MATCH — some tokens match
  { title: 'Accounting and Finance', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Business Management', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Digital Design', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Tourism and Hospitality', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
  { title: 'Music', expectedVerdict: 'PASS', expectedLevel: 'HIGH' },
];

describe('Deterministic Localizer — QA Sample (50 titles)', () => {
  const results: Array<{
    title: string;
    ar: string | null;
    confidence: number;
    level: string;
    verdict: string;
    matched: string[];
    unmatched: string[];
  }> = [];

  QA_SAMPLE.forEach(({ title, expectedLevel }, i) => {
    it(`#${i + 1}: "${title}" → ${expectedLevel}`, () => {
      const result = localizeTitle(title, glossaryMap);
      
      results.push({
        title,
        ar: result.localized,
        confidence: result.confidence,
        level: result.level,
        verdict: result.level === 'HIGH' ? 'PASS' : (result.confidence > 0 ? 'NEEDS_FIX' : 'BLOCKED'),
        matched: result.matchedTokens,
        unmatched: result.unmatchedTokens,
      });

      expect(result.level).toBe(expectedLevel);
    });
  });

  it('summary: at least 60% PASS rate', () => {
    // Run all localizations
    const allResults = QA_SAMPLE.map(({ title }) => localizeTitle(title, glossaryMap));
    const highCount = allResults.filter(r => r.level === 'HIGH').length;
    const passRate = highCount / allResults.length;
    
    console.log('\n===== QA SAMPLE RESULTS =====');
    allResults.forEach((r, i) => {
      const verdict = r.level === 'HIGH' ? 'PASS' : (r.confidence > 0 ? 'NEEDS_FIX' : 'BLOCKED');
      console.log(`${i + 1}. "${r.original}" → ${r.localized || '(null)'} | ${(r.confidence * 100).toFixed(0)}% | ${verdict}`);
    });
    console.log(`\nPASS: ${highCount}/${allResults.length} (${(passRate * 100).toFixed(0)}%)`);
    console.log(`BLOCKED: ${allResults.filter(r => r.confidence === 0).length}`);
    console.log(`NEEDS_FIX: ${allResults.filter(r => r.level === 'LOW' && r.confidence > 0).length}`);
    
    expect(passRate).toBeGreaterThanOrEqual(0.6);
  });
});
