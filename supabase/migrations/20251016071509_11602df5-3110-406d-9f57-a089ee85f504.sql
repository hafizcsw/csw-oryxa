-- إنشاء enum للأدوار
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- إنشاء جدول user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- تفعيل RLS على user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة: كل مستخدم يستطيع رؤية دوره الخاص
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- إنشاء دالة is_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS للمنح الدراسية (Admin-only write)
ALTER TABLE scholarships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sch_select_public ON scholarships;
CREATE POLICY sch_select_public ON scholarships
  FOR SELECT USING (true);

DROP POLICY IF EXISTS sch_admin_write ON scholarships;
CREATE POLICY sch_admin_write ON scholarships
  FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS sch_admin_update ON scholarships;
CREATE POLICY sch_admin_update ON scholarships
  FOR UPDATE 
  USING (public.is_admin(auth.uid())) 
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS sch_admin_delete ON scholarships;
CREATE POLICY sch_admin_delete ON scholarships
  FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- RLS للفعاليات (Admin-only write)
ALTER TABLE education_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ev_select_public ON education_events;
CREATE POLICY ev_select_public ON education_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS ev_admin_write ON education_events;
CREATE POLICY ev_admin_write ON education_events
  FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS ev_admin_update ON education_events;
CREATE POLICY ev_admin_update ON education_events
  FOR UPDATE 
  USING (public.is_admin(auth.uid())) 
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS ev_admin_delete ON education_events;
CREATE POLICY ev_admin_delete ON education_events
  FOR DELETE 
  USING (public.is_admin(auth.uid()));