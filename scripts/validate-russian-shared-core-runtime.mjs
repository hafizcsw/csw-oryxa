import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const foundationMigrationPath = 'supabase/migrations/20260322110000_russian_execution_pack_1_foundation.sql';
const runtimeClosureMigrationPath = 'supabase/migrations/20260322124500_russian_execution_pack_1_runtime_closure.sql';
const scoringPayloadMigrationPath = 'supabase/migrations/20260322153000_russian_assessment_scoring_payloads.sql';

const foundationMigration = readText(foundationMigrationPath);
const runtimeClosureMigration = readText(runtimeClosureMigrationPath);
const scoringPayloadMigration = readText(scoringPayloadMigrationPath);
const courses = readJson('supabase/seed/russian/02_courses.json');
const modules = readJson('supabase/seed/russian/03_modules_shared_core.json');
const lessons = readJson('supabase/seed/russian/04_lessons_shared_core.json');
const sections = readJson('supabase/seed/russian/05_lesson_sections_shared_core.json');
const templates = readJson('supabase/seed/russian/06_assessment_templates.json');
const examSets = readJson('supabase/seed/russian/07_exam_sets.json');

const errors = [];
const warnings = [];
const applyOrder = [foundationMigrationPath, runtimeClosureMigrationPath, scoringPayloadMigrationPath];
const seedOrder = [
  'supabase/seed/russian/01_readiness_dimensions.json',
  'supabase/seed/russian/02_courses.json',
  'supabase/seed/russian/03_modules_shared_core.json',
  'supabase/seed/russian/04_lessons_shared_core.json',
  'supabase/seed/russian/05_lesson_sections_shared_core.json',
  'supabase/seed/russian/06_assessment_templates.json',
  'supabase/seed/russian/07_exam_sets.json',
];
const runtimeOrder = [
  'foundations_01_script_sounds',
  'foundations_02_core_interaction',
  'foundations_03_survival_navigation',
  'academic_01_classroom_basics',
  'academic_02_reading_patterns',
  'checkpoint_01_foundation',
  'academic_03_note_taking_response',
  'grammar_01_case_awareness',
  'grammar_02_verbs_motion_time',
  'checkpoint_02_academic_entry',
];

const courseKeys = new Set(courses.map((course) => course.course_key));
const moduleKeys = new Set(modules.map((module) => module.module_key));
const lessonKeys = new Set(lessons.map((lesson) => lesson.lesson_key));
const sectionLessonKeys = new Set(sections.map((section) => section.lesson_key));

for (const migrationPath of applyOrder) {
  if (!fs.existsSync(path.join(root, migrationPath))) {
    errors.push(`missing migration ${migrationPath}`);
  }
}

for (const seedPath of seedOrder) {
  if (!fs.existsSync(path.join(root, seedPath))) {
    errors.push(`missing seed file ${seedPath}`);
  }
}

for (const snippet of ['CREATE TABLE IF NOT EXISTS public.russian_learner_unlocks', 'CREATE TABLE IF NOT EXISTS public.russian_assessment_templates', 'CREATE TABLE IF NOT EXISTS public.russian_exam_sets']) {
  if (!foundationMigration.includes(snippet)) {
    errors.push(`foundation migration missing expected object: ${snippet}`);
  }
}

for (const snippet of ['assessment_template_id', 'exam_set_id', 'num_nonnulls']) {
  if (!runtimeClosureMigration.includes(snippet)) {
    errors.push(`runtime closure migration missing expected fragment ${snippet}`);
  }
}

for (const snippet of ['section_scores_json', 'feedback_json']) {
  if (!scoringPayloadMigration.includes(snippet)) {
    errors.push(`scoring payload migration missing expected fragment ${snippet}`);
  }
}

for (const moduleKey of runtimeOrder) {
  if (!moduleKeys.has(moduleKey)) {
    errors.push(`runtime module order references missing module ${moduleKey}`);
  }
}

for (const module of modules) {
  if (!courseKeys.has(module.course_key)) {
    errors.push(`module ${module.module_key} references missing course ${module.course_key}`);
  }
}

for (const lesson of lessons) {
  if (!moduleKeys.has(lesson.module_key)) {
    errors.push(`lesson ${lesson.lesson_key} references missing module ${lesson.module_key}`);
  }
  if (!sectionLessonKeys.has(lesson.lesson_key)) {
    errors.push(`lesson ${lesson.lesson_key} is missing sections`);
  }
}

function validateSectionBlueprint(ownerLabel, blueprint, expectedItemCount) {
  const sections = Array.isArray(blueprint?.sections) ? blueprint.sections : [];
  if (!sections.length) {
    errors.push(`${ownerLabel} must define blueprint_json.sections`);
    return;
  }

  let itemCount = 0;
  for (const section of sections) {
    if (!Array.isArray(section?.items) || !section.items.length) {
      errors.push(`${ownerLabel} section ${section?.key ?? 'unknown'} must define items`);
      continue;
    }
    itemCount += section.items.length;

    for (const item of section.items) {
      if (item.lesson_key && !lessonKeys.has(item.lesson_key)) {
        errors.push(`${ownerLabel} item ${item.item_key} references missing lesson ${item.lesson_key}`);
      }
      if (!item.prompt) {
        errors.push(`${ownerLabel} item ${item.item_key} is missing prompt text`);
      }
      if (!item.scoring?.mode) {
        errors.push(`${ownerLabel} item ${item.item_key} is missing scoring.mode`);
      }
      if (item.scoring?.mode === 'exact_match' && (!Array.isArray(item.scoring.acceptedAnswers) || !item.scoring.acceptedAnswers.length)) {
        errors.push(`${ownerLabel} item ${item.item_key} exact_match scoring requires acceptedAnswers`);
      }
      if (item.scoring?.mode === 'concept_match' && (!Array.isArray(item.scoring.requiredConceptGroups) || !item.scoring.requiredConceptGroups.length)) {
        errors.push(`${ownerLabel} item ${item.item_key} concept_match scoring requires requiredConceptGroups`);
      }
    }
  }

  if (itemCount !== expectedItemCount) {
    errors.push(`${ownerLabel} total_items=${expectedItemCount} but blueprint defines ${itemCount}`);
  }
}

const checkpointTemplate = templates.find((template) => template.template_key === 'shared_core_checkpoint_01_v1');
if (!checkpointTemplate) {
  errors.push('shared_core_checkpoint_01_v1 template missing');
} else {
  for (const lessonKey of checkpointTemplate.lesson_scope_keys) {
    if (!lessonKeys.has(lessonKey)) errors.push(`checkpoint template references missing lesson ${lessonKey}`);
  }
  validateSectionBlueprint('shared_core_checkpoint_01_v1', checkpointTemplate.blueprint_json, checkpointTemplate.total_items);
}

const examSet = examSets.find((entry) => entry.exam_set_key === 'shared_core_exam_set_01_v1');
if (!examSet) {
  errors.push('shared_core_exam_set_01_v1 exam set missing');
} else {
  if (examSet.release_stage !== 'active') {
    errors.push('shared_core_exam_set_01_v1 must be active for staging verification');
  }
  for (const lessonKey of examSet.lesson_scope_keys) {
    if (!lessonKeys.has(lessonKey)) errors.push(`exam set references missing lesson ${lessonKey}`);
  }
  validateSectionBlueprint('shared_core_exam_set_01_v1', examSet.blueprint_json, examSet.total_items);
}

warnings.push('Checkpoint 01 pass evidence must come from russian_assessment_attempts; checkpoint lesson completion alone is not a pass.');
warnings.push('Post-checkpoint modules must remain locked until a passed Checkpoint 01 attempt exists.');

if (errors.length) {
  console.error('Russian shared-core staging validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Russian shared-core staging validation passed.');
console.log(`Apply order: ${applyOrder.join(' -> ')}`);
console.log(`Seed order: ${seedOrder.join(' -> ')}`);
console.log(`Courses: ${courses.length}`);
console.log(`Modules: ${modules.length}`);
console.log(`Lessons: ${lessons.length}`);
console.log(`Sections: ${sections.length}`);
console.log(`Templates: ${templates.length}`);
console.log(`Exam sets: ${examSets.length}`);
for (const warning of warnings) console.log(`Warning: ${warning}`);
