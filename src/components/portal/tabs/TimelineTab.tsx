import { useState } from "react";
import { Clock, Plus, FileText, CreditCard, Bell, User, CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStudentTimeline, TimelineEvent } from "@/hooks/useStudentTimeline";
import { formatDistanceToNow, type Locale } from "date-fns";
import { ar, enUS, fr, ru, es, zhCN, hi, bn, pt, ja, de, ko } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimelineTabProps {
  userId?: string;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  stage_change: RefreshCw,
  document_verified: CheckCircle,
  document_rejected: XCircle,
  document_uploaded: FileText,
  payment_confirmed: CreditCard,
  payment_pending: CreditCard,
  note_public: Bell,
  profile_updated: User,
  service_update: Bell,
};

const EVENT_COLORS: Record<string, string> = {
  stage_change: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  document_verified: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  document_rejected: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  document_uploaded: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
  payment_confirmed: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  payment_pending: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
  note_public: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
  profile_updated: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  service_update: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30',
};

const DATE_LOCALES: Record<string, Locale> = {
  ar, en: enUS, fr, ru, es, zh: zhCN, hi, bn, pt, ja, de, ko
};

function getEventIcon(eventType: string) {
  return EVENT_ICONS[eventType] || Bell;
}

function getEventColor(eventType: string) {
  return EVENT_COLORS[eventType] || 'text-muted-foreground bg-muted';
}

export function TimelineTab({ userId }: TimelineTabProps) {
  const { t, language } = useLanguage();
  const { events, loading, error, featureAvailable, refetch } = useStudentTimeline(userId);
  const [newNote, setNewNote] = useState('');
  const dateLocale = DATE_LOCALES[language] || enUS;

  const renderEvent = (event: TimelineEvent) => {
    const Icon = getEventIcon(event.event_type);
    const colorClass = getEventColor(event.event_type);

    return (
      <div key={event.id} className="flex gap-4 relative">
        {/* Timeline line */}
        <div className="absolute right-[19px] top-10 bottom-0 w-0.5 bg-border" />
        
        {/* Icon */}
        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 pb-6">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{event.event_title}</p>
                {event.event_description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {event.event_description}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(event.created_at), { 
                  addSuffix: true, 
                  locale: dateLocale 
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-success" />
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('portal.timeline.title')}</h2>
        </div>
      </div>

      {/* Add Note Section */}
      <div className="bg-card rounded-xl border border-border p-4">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={t('portal.timeline.addNotePlaceholder')}
          className="min-h-[120px] resize-none mb-3 bg-background"
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!newNote.trim()}
        >
          <Plus className="h-4 w-4" />
          {t('portal.timeline.addNote')}
        </Button>
      </div>

      {/* Timeline Events */}
      <div className="bg-card rounded-xl border border-border p-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !featureAvailable ? (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-warning/50 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {t('portal.timeline.notAvailable')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('portal.timeline.comingSoon')}
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <XCircle className="w-16 h-16 text-destructive/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch} className="mt-4 gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('portal.timeline.retry')}
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('portal.timeline.noEvents')}</p>
          </div>
        ) : (
          <div className="space-y-0">
            {events.map(renderEvent)}
          </div>
        )}
      </div>
    </div>
  );
}
