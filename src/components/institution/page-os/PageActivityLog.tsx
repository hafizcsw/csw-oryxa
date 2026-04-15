/**
 * Page activity log panel — shows all operator actions.
 * Accessible to full_control and page_admin roles.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface PageActivityLogProps {
  universityId: string;
}

interface Activity {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  actor_user_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function PageActivityLog({ universityId }: PageActivityLogProps) {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'activity.list', university_id: universityId } });
      if (data?.ok) setActivities(data.activities || []);
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const actionColor: Record<string, string> = {
    staff_added: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    staff_removed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    staff_role_changed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    post_created: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    post_updated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    post_deleted: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    comment_moderated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    setting_changed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    inbox_replied: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  };

  if (loading) {
    return <div className="py-6 text-center text-sm text-muted-foreground">{t('pageOS.common.loading')}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{t('pageOS.activity.title')}</h3>
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{t('pageOS.activity.empty')}</p>
      ) : (
        <div className="space-y-1">
          {activities.map(a => (
            <div key={a.id} className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 text-sm">
              <Badge className={`text-[10px] shrink-0 ${actionColor[a.action_type] || 'bg-muted text-muted-foreground'}`}>
                {a.action_type.replace(/_/g, ' ')}
              </Badge>
              <span className="text-muted-foreground truncate flex-1">
                {a.target_type}{a.target_id ? ` · ${a.target_id.slice(0, 8)}` : ''}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(a.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
