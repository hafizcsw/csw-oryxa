/**
 * Static Academic Glossary Dictionary — EN → AR
 * 
 * Generated from translation_glossary table.
 * This is a STATIC artifact — no runtime DB query needed.
 * 
 * Architecture decision: We use a static dictionary instead of
 * fetching from translation_glossary at runtime because:
 * 1. translation_glossary has RLS (admin-only read)
 * 2. Zero network overhead — instant lookup
 * 3. No RLS bypass or public view needed
 * 4. Dictionary changes require a code update (intentional governance)
 * 
 * To update: re-export from DB and regenerate this file.
 * Last synced: 2026-03-09
 */

import type { GlossaryEntry } from '@/utils/deterministicLocalizer';

export const ACADEMIC_GLOSSARY_EN_AR: GlossaryEntry[] = [
  // ===== Multi-word phrases (longest first for greedy matching) =====
  { source_text: 'QS World University Rankings', target_text: 'تصنيف QS العالمي للجامعات', preserve_rule: 'transliterate' },
  { source_text: 'Business Administration', target_text: 'إدارة الأعمال' },
  { source_text: 'Supply Chain Management', target_text: 'إدارة سلسلة الإمداد' },
  { source_text: 'International Relations', target_text: 'العلاقات الدولية' },
  { source_text: 'Information Technology', target_text: 'تقنية المعلومات' },
  { source_text: 'Electrical Engineering', target_text: 'الهندسة الكهربائية' },
  { source_text: 'UniRank Global Ranking', target_text: 'تصنيف UniRank العالمي', preserve_rule: 'transliterate' },
  { source_text: 'Industrial Engineering', target_text: 'الهندسة الصناعية' },
  { source_text: 'Biomedical Engineering', target_text: 'الهندسة الطبية الحيوية' },
  { source_text: 'Private Not-for-Profit', target_text: 'خاصة غير ربحية' },
  { source_text: 'Mechanical Engineering', target_text: 'الهندسة الميكانيكية' },
  { source_text: 'Environmental Science', target_text: 'العلوم البيئية' },
  { source_text: 'Aerospace Engineering', target_text: 'هندسة الفضاء' },
  { source_text: 'Computer Engineering', target_text: 'هندسة الحاسوب' },
  { source_text: 'Software Engineering', target_text: 'هندسة البرمجيات' },
  { source_text: 'Information Systems', target_text: 'نظم المعلومات' },
  { source_text: 'CWUR World Rankings', target_text: 'تصنيف CWUR العالمي', preserve_rule: 'transliterate' },
  { source_text: 'Political Science', target_text: 'العلوم السياسية' },
  { source_text: 'Civil Engineering', target_text: 'الهندسة المدنية' },
  { source_text: 'Criminal Justice', target_text: 'العدالة الجنائية' },
  { source_text: 'Computer Science', target_text: 'علوم الحاسوب' },
  { source_text: 'Health Sciences', target_text: 'العلوم الصحية' },
  { source_text: 'Foundation Year', target_text: 'السنة التحضيرية' },
  { source_text: 'Human Resources', target_text: 'الموارد البشرية' },
  { source_text: 'Urban Planning', target_text: 'التخطيط العمراني' },
  { source_text: 'Graphic Design', target_text: 'التصميم الجرافيكي' },
  { source_text: 'Public Health', target_text: 'الصحة العامة' },
  { source_text: 'Food Science', target_text: 'علوم الغذاء' },
  { source_text: 'Data Science', target_text: 'علم البيانات' },
  { source_text: 'Fine Arts', target_text: 'الفنون الجميلة' },

  // ===== Single-word disciplines =====
  { source_text: 'Cybersecurity', target_text: 'الأمن السيبراني' },
  { source_text: 'Biotechnology', target_text: 'التكنولوجيا الحيوية' },
  { source_text: 'Architecture', target_text: 'العمارة' },
  { source_text: 'Anthropology', target_text: 'الأنثروبولوجيا' },
  { source_text: 'Communication', target_text: 'الاتصال' },
  { source_text: 'Archaeology', target_text: 'علم الآثار' },
  { source_text: 'Linguistics', target_text: 'اللسانيات' },
  { source_text: 'Hospitality', target_text: 'الضيافة' },
  { source_text: 'Engineering', target_text: 'الهندسة' },
  { source_text: 'Management', target_text: 'الإدارة' },
  { source_text: 'Accounting', target_text: 'المحاسبة' },
  { source_text: 'Psychology', target_text: 'علم النفس' },
  { source_text: 'Journalism', target_text: 'الصحافة' },
  { source_text: 'Veterinary', target_text: 'الطب البيطري' },
  { source_text: 'Philosophy', target_text: 'الفلسفة' },
  { source_text: 'Statistics', target_text: 'الإحصاء' },
  { source_text: 'Sociology', target_text: 'علم الاجتماع' },
  { source_text: 'Nutrition', target_text: 'التغذية' },
  { source_text: 'Animation', target_text: 'الرسوم المتحركة' },
  { source_text: 'Marketing', target_text: 'التسويق' },
  { source_text: 'Astronomy', target_text: 'علم الفلك' },
  { source_text: 'Geography', target_text: 'الجغرافيا' },
  { source_text: 'Education', target_text: 'التربية' },
  { source_text: 'Dentistry', target_text: 'طب الأسنان' },
  { source_text: 'Economics', target_text: 'الاقتصاد' },
  { source_text: 'Chemistry', target_text: 'الكيمياء' },
  { source_text: 'Theology', target_text: 'اللاهوت' },
  { source_text: 'Medicine', target_text: 'الطب' },
  { source_text: 'Business', target_text: 'إدارة الأعمال' },
  { source_text: 'Pharmacy', target_text: 'الصيدلة' },
  { source_text: 'Geology', target_text: 'الجيولوجيا' },
  { source_text: 'Biology', target_text: 'الأحياء' },
  { source_text: 'Tourism', target_text: 'السياحة' },
  { source_text: 'Physics', target_text: 'الفيزياء' },
  { source_text: 'Finance', target_text: 'التمويل' },
  { source_text: 'Fashion', target_text: 'الأزياء' },
  { source_text: 'Nursing', target_text: 'التمريض' },
  { source_text: 'English', target_text: 'اللغة الإنجليزية' },
  { source_text: 'History', target_text: 'التاريخ' },
  { source_text: 'Design', target_text: 'التصميم' },
  { source_text: 'Music', target_text: 'الموسيقى' },
  { source_text: 'Media', target_text: 'الإعلام' },
  { source_text: 'Film', target_text: 'السينما' },
  { source_text: 'Arts', target_text: 'الآداب' },
  { source_text: 'Law', target_text: 'القانون' },

  // ===== Modifiers =====
  { source_text: 'Computational', target_text: 'الحوسبية' },
  { source_text: 'Environmental', target_text: 'البيئية' },
  { source_text: 'International', target_text: 'الدولية' },
  { source_text: 'Agriculture', target_text: 'الزراعة' },
  { source_text: 'Technology', target_text: 'التكنولوجيا' },
  { source_text: 'Molecular', target_text: 'الجزيئية' },
  { source_text: 'Sciences', target_text: 'العلوم' },
  { source_text: 'Clinical', target_text: 'السريرية' },
  { source_text: 'Applied', target_text: 'التطبيقية' },
  { source_text: 'Digital', target_text: 'الرقمية' },
  { source_text: 'Nuclear', target_text: 'النووية' },
  { source_text: 'Marine', target_text: 'البحرية' },
  { source_text: 'Public', target_text: 'العامة' },
  { source_text: 'Studies', target_text: 'الدراسات' },
  { source_text: 'and', target_text: 'و' },

  // ===== Structural (degrees, modes) =====
  { source_text: "Bachelor's", target_text: 'البكالوريوس' },
  { source_text: "Master's", target_text: 'الماجستير' },
  { source_text: 'Diploma', target_text: 'دبلوم' },
  { source_text: 'Online', target_text: 'عن بعد' },
  { source_text: 'Hybrid', target_text: 'مختلط' },
  { source_text: 'Blended', target_text: 'مدمج' },
  { source_text: 'On Campus', target_text: 'حضوري' },
  { source_text: 'PhD', target_text: 'الدكتوراه', preserve_rule: 'preserve' },
  { source_text: 'GPA', target_text: 'المعدل التراكمي', preserve_rule: 'preserve' },
  { source_text: 'IELTS', target_text: 'IELTS', preserve_rule: 'preserve' },
  { source_text: 'TOEFL', target_text: 'TOEFL', preserve_rule: 'preserve' },
  { source_text: 'SAT', target_text: 'SAT', preserve_rule: 'preserve' },
];
