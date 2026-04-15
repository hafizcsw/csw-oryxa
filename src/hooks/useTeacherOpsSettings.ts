import { useEffect, useState } from 'react';

export type TeacherType = 'language_teacher' | 'curriculum_exam_teacher';

export interface TeacherOpsSettings {
  teacherType: TeacherType;
  examModeDefault: boolean;
  requiredSessionsPerWeek: number;
  dailySessionCap: number;
  aiRecapDefault: 'teacher_approval' | 'auto_after_session' | 'blocked';
}

const KEY = 'teacher_ops_settings_v1';

const DEFAULTS: TeacherOpsSettings = {
  teacherType: 'language_teacher',
  examModeDefault: false,
  requiredSessionsPerWeek: 3,
  dailySessionCap: 1,
  aiRecapDefault: 'teacher_approval',
};

export function useTeacherOpsSettings() {
  const [settings, setSettings] = useState<TeacherOpsSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({ ...DEFAULTS, ...parsed });
      }
    } catch {
      setSettings(DEFAULTS);
    }
  }, []);

  const updateSettings = (partial: Partial<TeacherOpsSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  return { settings, updateSettings };
}
