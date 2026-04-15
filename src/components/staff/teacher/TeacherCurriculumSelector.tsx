import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getRussianCurriculumModules, listLessonsForModule } from '@/lib/teacherCurriculum';

interface Props {
  moduleSlug: string;
  lessonSlug: string;
  onModuleChange: (value: string) => void;
  onLessonChange: (value: string) => void;
}

export function TeacherCurriculumSelector({ moduleSlug, lessonSlug, onModuleChange, onLessonChange }: Props) {
  const { t } = useLanguage();
  const modules = useMemo(() => getRussianCurriculumModules(), []);
  const lessons = useMemo(
    () => (moduleSlug ? listLessonsForModule(moduleSlug) : []),
    [moduleSlug],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {t('staff.teacher.session.module_label', { defaultValue: 'Module' })}
        </label>
        <Select value={moduleSlug || 'none'} onValueChange={(value) => onModuleChange(value === 'none' ? '' : value)}>
          <SelectTrigger>
            <SelectValue placeholder={t('staff.teacher.session.select_module', { defaultValue: 'Select module' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('staff.teacher.session.no_module', { defaultValue: 'No module' })}</SelectItem>
            {modules.map((module) => (
              <SelectItem key={module.slug} value={module.slug}>
                {t(`languages.russian.runtime.modules.${module.slug}.title`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {t('staff.teacher.session.lesson_label', { defaultValue: 'Lesson' })}
        </label>
        <Select
          value={lessonSlug || 'none'}
          onValueChange={(value) => onLessonChange(value === 'none' ? '' : value)}
          disabled={!moduleSlug}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('staff.teacher.session.select_lesson', { defaultValue: 'Select lesson' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('staff.teacher.session.no_lesson', { defaultValue: 'No lesson' })}</SelectItem>
            {lessons.map((lesson) => (
              <SelectItem key={lesson.slug} value={lesson.slug}>
                {t(`languages.russian.runtime.lessons.${lesson.slug}.title`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
