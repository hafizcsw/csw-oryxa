/**
 * Facebook-style Messenger + Notifications icons for the global navbar.
 * Uses canonical comm backbone for unread counts.
 */
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommUnreadCount } from '@/hooks/useCommApi';
import { useTranslation } from 'react-i18next';

interface HeaderMessengerProps {
  onMessagesClick?: () => void;
}

export function HeaderMessenger({ onMessagesClick }: HeaderMessengerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { count } = useCommUnreadCount();

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => (onMessagesClick ? onMessagesClick() : navigate('/messages'))}
        className="relative rounded-full hover:bg-muted transition-all h-8 w-8 sm:h-9 sm:w-9"
        title={t('nav.messages')}
      >
        <MessageCircle className="w-[18px] h-[18px] text-foreground/80" />
        {count > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="relative rounded-full hover:bg-muted transition-all h-8 w-8 sm:h-9 sm:w-9"
        title={t('notifications.title')}
      >
        <Bell className="w-[18px] h-[18px] text-foreground/80" />
      </Button>
    </div>
  );
}
