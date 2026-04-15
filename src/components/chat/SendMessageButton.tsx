/**
 * SendMessageButton — Opens a comm thread with a teacher via canonical backbone.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { commCreateThread } from '@/hooks/useCommApi';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Loader2 } from 'lucide-react';
import { DSButton } from '@/components/design-system/DSButton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SendMessageButtonProps {
  teacherUserId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: string;
  className?: string;
  dsButton?: boolean;
  iconOnly?: boolean;
}

export function SendMessageButton({
  teacherUserId,
  variant = 'outline',
  size = 'sm',
  className,
  dsButton = false,
  iconOnly = false,
}: SendMessageButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error(t('comm.loginRequired'));
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      const result = await commCreateThread({
        thread_type: 'teacher_student',
        first_message: '👋',
        participants: [{ user_id: teacherUserId, role: 'teacher' }],
      });
      if (result?.thread_id) {
        navigate('/messages');
      } else {
        toast.error(t('comm.errorCreating'));
      }
    } catch (err) {
      console.error('SendMessageButton error:', err);
      toast.error(t('comm.errorCreating'));
    }
    setLoading(false);
  };

  const icon = loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />;
  const label = t('languages.teachers.sendMessage');

  if (dsButton) {
    return (
      <DSButton variant={variant as any} size={(size || 'sm') as any} className={className} onClick={handleClick} disabled={loading}>
        {icon}
        {!iconOnly && <span className="ms-1.5">{label}</span>}
      </DSButton>
    );
  }

  return (
    <Button variant={variant} size={(size || 'sm') as any} className={className} onClick={handleClick} disabled={loading}>
      {icon}
      {!iconOnly && <span className="ms-1.5">{label}</span>}
    </Button>
  );
}
