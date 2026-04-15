/**
 * StudentActionItems — Student-facing surface showing teacher-assigned actions.
 */
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStudentActionItems, completeStudentActionItem } from '@/hooks/useSessionActionItems';
import type { SessionActionItem } from '@/hooks/useSessionActionItems';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  CheckCircle2, Clock, AlertTriangle, BookOpen,
  Send, ClipboardCheck, Target, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, typeof BookOpen> = {
  homework: BookOpen,
  review: ClipboardCheck,
  checkpoint: Target,
  session_recovery: AlertTriangle,
  exam_recovery: AlertTriangle,
  teacher_follow_up: Sparkles,
};

export function StudentActionItems() {
  const { t } = useLanguage();
  const { items, loading, refresh } = useStudentActionItems();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const pending = items.filter(i => i.status === 'pending');
  const completed = items.filter(i => i.status === 'completed');

  const handleComplete = async (item: SessionActionItem) => {
    setSubmitting(item.id);
    const res = await completeStudentActionItem(item.id, responses[item.id] || undefined);
    if (res.ok) {
      toast({ title: t('languages.dashboard.actions.completed', { defaultValue: 'Action completed!' }) });
      refresh();
    } else {
      toast({ title: t('languages.dashboard.actions.error', { defaultValue: 'Failed to complete action' }), variant: 'destructive' });
    }
    setSubmitting(null);
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-border/50">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          {t('languages.dashboard.actions.title', { defaultValue: 'Teacher Actions' })}
        </h3>
        {pending.length > 0 && (
          <span className="ms-auto inline-flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {pending.length}
          </span>
        )}
      </div>

      <div className="p-5 space-y-3">
        {pending.map(item => {
          const Icon = TYPE_ICONS[item.action_type] || BookOpen;
          return (
            <div key={item.id} className="rounded-xl border border-border p-4 space-y-3 hover:bg-muted/10 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {t(`languages.dashboard.actions.type_${item.action_type}`, { defaultValue: item.action_type.replace(/_/g, ' ') })}
                      </Badge>
                      <Badge variant={item.priority === 'urgent' ? 'destructive' : item.priority === 'high' ? 'secondary' : 'outline'} className="text-[10px]">
                        {t(`languages.dashboard.actions.priority_${item.priority}`, { defaultValue: item.priority })}
                      </Badge>
                      {item.related_lesson_slug && (
                        <span className="text-[10px] text-muted-foreground">{item.related_module_slug} / {item.related_lesson_slug}</span>
                      )}
                      {item.recap_available && (
                        <Badge variant="outline" className="text-[10px] text-primary">
                          <Sparkles className="h-2.5 w-2.5 me-1" />
                          {t('languages.dashboard.actions.recap_available', { defaultValue: 'AI Recap' })}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {item.due_at && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3" />
                    {new Date(item.due_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <Textarea
                value={responses[item.id] || ''}
                onChange={e => setResponses(prev => ({ ...prev, [item.id]: e.target.value }))}
                placeholder={t('languages.dashboard.actions.response_placeholder', { defaultValue: 'Your response (optional)...' })}
                rows={2}
                className="text-sm bg-background/50 border-border/50 rounded-lg"
              />
              <Button
                size="sm"
                disabled={submitting === item.id}
                onClick={() => handleComplete(item)}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {t('languages.dashboard.actions.mark_complete', { defaultValue: 'Mark Complete' })}
              </Button>
            </div>
          );
        })}

        {completed.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t('languages.dashboard.actions.completed_section', { defaultValue: 'Completed' })} ({completed.length})
            </p>
            {completed.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="line-through">{item.title}</span>
                {item.completed_at && <span className="text-[10px]">· {new Date(item.completed_at).toLocaleDateString()}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
