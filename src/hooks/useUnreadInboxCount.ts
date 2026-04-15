/**
 * useUnreadInboxCount — Delegates to canonical comm backbone.
 * @deprecated Use useCommUnreadCount from useCommApi directly.
 */
import { useCommUnreadCount } from '@/hooks/useCommApi';

export function useUnreadInboxCount() {
  return useCommUnreadCount();
}
