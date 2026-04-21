/**
 * Facebook-style Notifications icon for the global navbar.
 * The Messages icon was removed; messaging lives in the floating support panel.
 */
import { NotificationsPopover } from './NotificationsPopover';

interface HeaderMessengerProps {
  onMessagesClick?: () => void;
}

export function HeaderMessenger(_props: HeaderMessengerProps) {
  return (
    <div className="flex items-center gap-0.5">
      <NotificationsPopover />
    </div>
  );
}
