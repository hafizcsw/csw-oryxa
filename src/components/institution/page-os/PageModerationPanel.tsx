/**
 * Page moderation panel — keyword filters, user restrictions, review queue.
 * Operator-only overlay on the live university page.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Plus, Trash2, Ban, Eye, EyeOff, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PageModerationPanelProps {
  universityId: string;
}

interface KeywordFilter {
  id: string;
  keyword: string;
  filter_action: string;
  created_at: string;
}

interface UserRestriction {
  id: string;
  user_id: string;
  restriction_type: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

interface QueueItem {
  id: string;
  body: string;
  user_id: string;
  visible: boolean;
  created_at: string;
  university_comment_moderation: Array<{ action: string; reason: string | null }>;
}

export function PageModerationPanel({ universityId }: PageModerationPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [filters, setFilters] = useState<KeywordFilter[]>([]);
  const [restrictions, setRestrictions] = useState<UserRestriction[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState('');
  const [newAction, setNewAction] = useState('hide');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [filtersRes, restrictionsRes, queueRes] = await Promise.all([
        supabase.functions.invoke('university-page-manage', { body: { action: 'moderation.keyword_filters.list', university_id: universityId } }),
        supabase.functions.invoke('university-page-manage', { body: { action: 'moderation.list_restrictions', university_id: universityId } }),
        supabase.functions.invoke('university-page-manage', { body: { action: 'comments.moderation_queue', university_id: universityId } }),
      ]);
      if (filtersRes.data?.ok) setFilters(filtersRes.data.filters);
      if (restrictionsRes.data?.ok) setRestrictions(restrictionsRes.data.restrictions);
      if (queueRes.data?.ok) setQueue(queueRes.data.queue);
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addFilter = async () => {
    if (!newKeyword.trim()) return;
    await supabase.functions.invoke('university-page-manage', { body: { action: 'moderation.keyword_filters.add', university_id: universityId, keyword: newKeyword.trim(), filter_action: newAction } });
    setNewKeyword('');
    toast({ title: t('pageOS.moderation.filterAdded') });
    fetchAll();
  };

  const removeFilter = async (filterId: string) => {
    await supabase.functions.invoke('university-page-manage', { body: { action: 'moderation.keyword_filters.remove', university_id: universityId, filter_id: filterId } });
    fetchAll();
  };

  const moderateComment = async (commentId: string, modAction: string) => {
    await supabase.functions.invoke('university-page-manage', { body: { action: 'comments.moderate', university_id: universityId, comment_id: commentId, mod_action: modAction } });
    toast({ title: t('pageOS.moderation.actionApplied') });
    fetchAll();
  };

  const removeRestriction = async (userId: string) => {
    await supabase.functions.invoke('university-page-manage', { body: { action: 'moderation.unrestrict_user', university_id: universityId, target_user_id: userId } });
    toast({ title: t('pageOS.moderation.restrictionRemoved') });
    fetchAll();
  };

  if (loading) {
    return <div className="py-6 text-center text-sm text-muted-foreground">{t('pageOS.common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{t('pageOS.moderation.title')}</h3>
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="queue" className="text-xs">
            {t('pageOS.moderation.reviewQueue')} {queue.length > 0 && <Badge variant="destructive" className="ms-1 text-[10px] px-1">{queue.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="filters" className="text-xs">{t('pageOS.moderation.keywordFilters')}</TabsTrigger>
          <TabsTrigger value="restrictions" className="text-xs">{t('pageOS.moderation.userRestrictions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-3 space-y-2">
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('pageOS.moderation.queueEmpty')}</p>
          ) : (
            queue.map(item => (
              <div key={item.id} className="p-3 rounded-lg border bg-card">
                <p className="text-sm mb-2">{item.body}</p>
                <div className="flex items-center gap-2">
                  {item.university_comment_moderation?.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{m.action}{m.reason ? `: ${m.reason}` : ''}</Badge>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => moderateComment(item.id, 'show')}>
                    <Eye className="w-3 h-3" /> {t('pageOS.moderation.approve')}
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => moderateComment(item.id, 'delete')}>
                    <Trash2 className="w-3 h-3" /> {t('pageOS.moderation.reject')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="filters" className="mt-3 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={t('pageOS.moderation.keywordPlaceholder')}
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <Select value={newAction} onValueChange={setNewAction}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hide">{t('pageOS.moderation.actionHide')}</SelectItem>
                <SelectItem value="flag">{t('pageOS.moderation.actionFlag')}</SelectItem>
                <SelectItem value="block">{t('pageOS.moderation.actionBlock')}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 gap-1" onClick={addFilter} disabled={!newKeyword.trim()}>
              <Plus className="w-3 h-3" /> {t('pageOS.common.add')}
            </Button>
          </div>
          {filters.map(f => (
            <div key={f.id} className="flex items-center justify-between p-2 rounded border bg-card">
              <div className="flex items-center gap-2">
                <Filter className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm font-mono">{f.keyword}</span>
                <Badge variant="outline" className="text-[10px]">{f.filter_action}</Badge>
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeFilter(f.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="restrictions" className="mt-3 space-y-2">
          {restrictions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('pageOS.moderation.noRestrictions')}</p>
          ) : (
            restrictions.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded border bg-card">
                <div className="flex items-center gap-2">
                  <Ban className="w-3 h-3 text-destructive" />
                  <span className="text-xs font-mono">{r.user_id.slice(0, 8)}…</span>
                  <Badge variant="destructive" className="text-[10px]">{r.restriction_type}</Badge>
                  {r.reason && <span className="text-xs text-muted-foreground">{r.reason}</span>}
                </div>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => removeRestriction(r.user_id)}>
                  {t('pageOS.moderation.unrestrict')}
                </Button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
