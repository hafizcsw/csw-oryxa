-- Create student_timeline_events table
CREATE TABLE IF NOT EXISTS public.student_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_title TEXT NOT NULL,
  event_description TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create student_notifications table
CREATE TABLE IF NOT EXISTS public.student_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add new columns to customer_files table
ALTER TABLE public.customer_files 
ADD COLUMN IF NOT EXISTS document_category TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_review',
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Enable RLS
ALTER TABLE public.student_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for student_timeline_events
CREATE POLICY "Users can view their own timeline events"
  ON public.student_timeline_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all timeline events"
  ON public.student_timeline_events FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert timeline events"
  ON public.student_timeline_events FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for student_notifications
CREATE POLICY "Users can view their own notifications"
  ON public.student_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.student_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
  ON public.student_notifications FOR ALL
  USING (is_admin(auth.uid()));

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_timeline_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_notifications;

-- Create function to automatically create timeline event when substage changes
CREATE OR REPLACE FUNCTION public.create_timeline_event_on_substage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_substage IS DISTINCT FROM OLD.student_substage THEN
    INSERT INTO public.student_timeline_events (
      user_id,
      event_type,
      event_title,
      event_description,
      event_data
    ) VALUES (
      NEW.id,
      'stage_change',
      'تحديث المرحلة',
      'تم تحديث مرحلتك إلى: ' || NEW.student_substage,
      jsonb_build_object(
        'old_stage', OLD.student_substage,
        'new_stage', NEW.student_substage,
        'progress', NEW.student_progress
      )
    );
    
    -- Create notification
    INSERT INTO public.student_notifications (
      user_id,
      title,
      message,
      type
    ) VALUES (
      NEW.id,
      'تحديث المرحلة',
      'تم تحديث مرحلتك في عملية التقديم',
      'stage_update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for substage changes
DROP TRIGGER IF EXISTS on_substage_change ON public.profiles;
CREATE TRIGGER on_substage_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_timeline_event_on_substage_change();