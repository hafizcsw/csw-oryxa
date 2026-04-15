/**
 * TeacherActionReflection — Shows teacher the status of assigned student actions.
 * Part of the shared teacher ↔ student lifecycle backbone.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { useTeacherActionItems } from '@/hooks/useSessionActionItems';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, Clock, AlertTriangle, Eye, ClipboardCheck
} from 'lucide-react';

interface Props {
  studentUserId?: string;
  onSelectSession?: (sessionId: string) => void;
}

export function TeacherActionReflection({ studentUserId, onSelectSession }: Props) {
  const { t } = useLanguage();
  const { items, loading } = useTeacherActionItems(studentUserId);

  if (loading || items.length === 0) return null;

  const pending = items.filter(i => i.status === 'pending');
  const completed = items.filter(i => i.status === 'completed');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          {t('staff.teacher.reflection.title', { defaultValue: 'Student Action Status' })}
          {pending.length > 0 && <Badge variant="destructive" className="text-xs">{pending.length} {t('staff.teacher.reflection.pending', { defaultValue: 'pending' })}</Badge>}
          {completed.length > 0 && <Badge variant="default" className="text-xs">{completed.length} {t('staff.teacher.reflection.done', { defaultValue: 'done' })}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Pending actions that need student attention */}
        {pending.slice(0, 10).map(item => (
          <div key={item.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">{item.action_type.replace(/_/g, ' ')}</Badge>
                  <Badge variant={item.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">{item.priority}</Badge>
                  {item.related_lesson_slug && <span className="text-xs text-muted-foreground">{item.related_lesson_slug}</span>}
                </div>
              </div>
            </div>
            {onSelectSession && (
              <Button variant="ghost" size="sm" onClick={() => onSelectSession(item.session_id)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}

        {/* Completed actions — student responses */}
        {completed.slice(0, 5).map(item => (
          <div key={item.id} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <Badge variant="default" className="text-xs ms-auto">
                {t('staff.teacher.reflection.completed', { defaultValue: 'Completed' })}
              </Badge>
            </div>
            {item.student_response && (
              <div className="mt-2 p-2 bg-background rounded border border-border">
                <p className="text-xs text-muted-foreground mb-0.5">{t('staff.teacher.reflection.student_response', { defaultValue: 'Student response' })}:</p>
                <p className="text-sm text-foreground">{item.student_response}</p>
              </div>
            )}
            {item.completed_at && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('staff.teacher.reflection.completed_at', { defaultValue: 'Completed' })}: {new Date(item.completed_at).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
