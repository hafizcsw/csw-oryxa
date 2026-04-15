/**
 * useRealTeacherAvatars — Fetches live avatar URLs for real teachers
 * so the marketplace always shows the latest uploaded photo.
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MOHAMED_AMIN_USER_ID } from '@/components/languages/teacherData';
import type { TeacherExtended } from '@/components/languages/teacherData';

/** CRM storage base for avatars */
const CRM_AVATARS_BASE = "https://hlrkyoxwbjsgqbncgzpi.supabase.co/storage/v1/object/public/avatars";

export function useRealTeacherAvatars(teachers: TeacherExtended[]): TeacherExtended[] {
  const [liveAvatarUrl, setLiveAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // profiles table has the LATEST avatar upload — check it first
        const { data } = await supabase
          .from('profiles')
          .select('avatar_storage_path')
          .eq('user_id', MOHAMED_AMIN_USER_ID)
          .maybeSingle();

        if (data?.avatar_storage_path) {
          const path = data.avatar_storage_path;
          const url = path.startsWith('http') 
            ? path 
            : `${CRM_AVATARS_BASE}/${path}`;
          setLiveAvatarUrl(`${url}?v=${Date.now()}`);
          return;
        }

        // Fallback to teacher_public_profiles
        const { data: pubData } = await (supabase as any)
          .from('teacher_public_profiles')
          .select('avatar_url')
          .eq('user_id', MOHAMED_AMIN_USER_ID)
          .maybeSingle();

        if (pubData?.avatar_url) {
          setLiveAvatarUrl(`${pubData.avatar_url}?v=${Date.now()}`);
        }
      } catch {
        // Silent fail — use fallback
      }
    })();
  }, []);

  return useMemo(() => {
    if (!liveAvatarUrl) return teachers;
    return teachers.map(t =>
      t.id === 't0' ? { ...t, avatar: liveAvatarUrl } : t
    );
  }, [teachers, liveAvatarUrl]);
}
