/**
 * CalendarAssistant — Zoom AI Companion-inspired glassmorphism chat panel
 * for managing teacher schedule via natural language.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Sparkles, AlertTriangle, Check, X, ArrowUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { AvailabilityRule, AvailabilityException, AvailabilityPreferences, BookedSession } from '@/hooks/useTeacherAvailability';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  pendingAction?: PendingAction;
}

interface PendingAction {
  type: 'add_rules' | 'remove_rules' | 'add_exception' | 'add_exceptions' | 'remove_exceptions' | 'update_preferences';
  description: string;
  data: any;
  conflicts?: Array<{ session: BookedSession; overlapStart: string; overlapEnd: string }>;
  applied?: boolean;
}

interface Props {
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  preferences: AvailabilityPreferences;
  bookedSessions: BookedSession[];
  onRulesChange: (rules: AvailabilityRule[]) => Promise<void>;
  onAddException: (e: Omit<AvailabilityException, 'id' | 'user_id'>) => Promise<void>;
  onRemoveExceptionsByDate: (dates: string[], exceptionType?: string) => Promise<void>;
  onPreferencesChange: (prefs: AvailabilityPreferences) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const SUGGESTIONS = [
  { labelKey: 'staff.teacher.calendar.suggestion_tips', defaultValue: 'What are some tips for managing my schedule?' },
  { labelKey: 'staff.teacher.calendar.suggestion_coordinate', defaultValue: 'Show my availability for this week' },
  { labelKey: 'staff.teacher.calendar.suggestion_schedule', defaultValue: 'Block Friday afternoon' },
  { labelKey: 'staff.teacher.calendar.suggestion_capabilities', defaultValue: 'What can you do?' },
];

export function CalendarAssistant({
  rules, exceptions, preferences, bookedSessions,
  onRulesChange, onAddException, onRemoveExceptionsByDate, onPreferencesChange, onRefresh,
}: Props) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const buildContext = useCallback(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const rulesStr = rules.map(r => `${dayNames[r.day_of_week]}: ${r.start_time}-${r.end_time}`).join('\n') || 'No rules set';
    const exceptionsStr = exceptions.map(e => `${e.exception_date}: ${e.exception_type}${e.start_time ? ` ${e.start_time}-${e.end_time}` : ' (all day)'}${e.reason ? ` (${e.reason})` : ''}`).join('\n') || 'None';
    const sessionsStr = bookedSessions.map(s => {
      const dt = new Date(s.scheduled_at);
      const students = s.students.map(st => st.full_name || 'Unknown').join(', ');
      return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${s.session_type} with ${students} (${s.status})`;
    }).join('\n') || 'No upcoming sessions';

    return `Current availability rules:\n${rulesStr}\n\nExceptions:\n${exceptionsStr}\n\nUpcoming sessions:\n${sessionsStr}\n\nPreferences: timezone=${preferences.timezone}, session_duration=${preferences.default_session_duration}min, buffer_before=${preferences.buffer_before_minutes}min, buffer_after=${preferences.buffer_after_minutes}min, public_booking=${preferences.public_booking_enabled}, max_sessions_per_day=${preferences.max_sessions_per_day}\n\nToday: ${new Date().toLocaleDateString()} (${dayNames[new Date().getDay()]})`;
  }, [rules, exceptions, bookedSessions, preferences]);

  const handleSend = async (overrideMessage?: string) => {
    const userMessage = overrideMessage || input.trim();
    if (!userMessage || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const context = buildContext();
      const invokePromise = supabase.functions.invoke('teacher-calendar-assistant', {
        body: {
          message: userMessage,
          context,
          conversation: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        },
      });

      const result = await Promise.race([
        invokePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('ASSISTANT_TIMEOUT')), 25000)
        ),
      ]);

      const { data, error } = result as { data: any; error: any };
      if (error) throw error;

      const response = data?.response || t('staff.teacher.calendar.assistant_error', { defaultValue: 'Sorry, I couldn\'t process that request.' });
      const action = data?.action as PendingAction | undefined;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        pendingAction: action,
      }]);
    } catch (err) {
      console.error('[CalendarAssistant] Error:', err);
      const isTimeout = err instanceof Error && err.message === 'ASSISTANT_TIMEOUT';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isTimeout
          ? t('staff.teacher.calendar.assistant_timeout', { defaultValue: 'The assistant took too long to respond. Please try again.' })
          : t('staff.teacher.calendar.assistant_error', { defaultValue: 'Sorry, something went wrong. Please try again.' }),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyAction = async (action: PendingAction, messageIndex: number) => {
    try {
      console.log('[CalendarAssistant] Applying action:', JSON.stringify(action));

      if (action.type === 'add_rules' && action.data?.rules) {
        const newRules = [...rules, ...action.data.rules];
        await onRulesChange(newRules);
      } else if (action.type === 'remove_rules' && action.data?.days !== undefined) {
        const daysToRemove: number[] = action.data.days;
        const newRules = rules.filter(r => !daysToRemove.includes(r.day_of_week));
        await onRulesChange(newRules);
      } else if (action.type === 'add_exception' && action.data) {
        const excData = {
          exception_date: action.data.exception_date,
          exception_type: action.data.exception_type,
          start_time: action.data.start_time || null,
          end_time: action.data.end_time || null,
          reason: action.data.reason || null,
        };
        console.log('[CalendarAssistant] Adding single exception:', excData);
        await onAddException(excData);
      } else if (action.type === 'add_exceptions' && action.data?.exceptions) {
        const excs = action.data.exceptions;
        console.log('[CalendarAssistant] Adding', excs.length, 'exceptions');
        for (const exc of excs) {
          const excData = {
            exception_date: exc.exception_date,
            exception_type: exc.exception_type,
            start_time: exc.start_time || null,
            end_time: exc.end_time || null,
            reason: exc.reason || null,
          };
          console.log('[CalendarAssistant] Inserting exception:', excData);
          await onAddException(excData);
        }
      } else if (action.type === 'remove_exceptions' && action.data?.dates) {
        console.log('[CalendarAssistant] Removing exceptions for dates:', action.data.dates);
        await onRemoveExceptionsByDate(action.data.dates, action.data.exception_type);
      } else if (action.type === 'update_preferences' && action.data) {
        await onPreferencesChange({ ...preferences, ...action.data });
      }

      setMessages(prev => prev.map((m, i) =>
        i === messageIndex && m.pendingAction
          ? { ...m, pendingAction: { ...m.pendingAction!, applied: true } }
          : m
      ));

      await onRefresh();
      toast.success(t('staff.teacher.calendar.action_applied', { defaultValue: 'Changes applied successfully!' }));
    } catch (err) {
      console.error('[CalendarAssistant] Apply error:', err);
      toast.error(t('staff.teacher.calendar.action_error', { defaultValue: 'Failed to apply changes. Please try again.' }));
    }
  };

  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
        {showWelcome ? (
          /* ═══ Zoom-style welcome screen ═══ */
          <div className="flex flex-col items-center justify-center h-full px-6 py-8">
            {/* Sparkle icon — like Zoom AI Companion logo */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center mb-6 shadow-lg shadow-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-1">
              {t('staff.teacher.calendar.assistant', { defaultValue: 'Calendar Assistant' })}
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-8 max-w-[260px]">
              {t('staff.teacher.calendar.assistant_subtitle', { defaultValue: 'Manage your schedule with natural language commands' })}
            </p>

            {/* Suggestion chips — Zoom AI Companion style */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(t(s.labelKey, { defaultValue: s.defaultValue }))}
                  className="text-start text-xs leading-snug px-3 py-3 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 text-foreground/80 hover:text-foreground"
                >
                  {t(s.labelKey, { defaultValue: s.defaultValue })}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ═══ Chat messages ═══ */
          <div className="px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'order-first' : ''}`}>
                  {msg.role === 'user' ? (
                    <div className="rounded-2xl rounded-ee-md px-3.5 py-2.5 text-sm bg-primary text-primary-foreground">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="text-sm text-foreground leading-relaxed">
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>p]:mb-2 [&>ul]:mt-1 [&>ol]:mt-1 [&>p:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Pending Action Card */}
                  {msg.pendingAction && !msg.pendingAction.applied && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-3 space-y-2.5">
                      <p className="text-xs font-medium text-foreground">{msg.pendingAction.description}</p>
                      {msg.pendingAction.conflicts && msg.pendingAction.conflicts.length > 0 && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5">
                          <p className="text-xs font-medium text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t('staff.teacher.calendar.conflicts_found', { defaultValue: 'Conflicts with existing sessions:' })}
                          </p>
                          {msg.pendingAction.conflicts.map((c, ci) => (
                            <p key={ci} className="text-xs text-muted-foreground mt-1">
                              {c.session.students.map(s => s.full_name).join(', ')} · {c.overlapStart}-{c.overlapEnd}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs gap-1 rounded-lg" onClick={() => applyAction(msg.pendingAction!, i)}>
                          <Check className="h-3 w-3" />
                          {t('staff.teacher.calendar.apply', { defaultValue: 'Apply' })}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-lg"
                          onClick={() => setMessages(prev => prev.map((m, idx) =>
                            idx === i ? { ...m, pendingAction: undefined } : m
                          ))}
                        >
                          <X className="h-3 w-3" />
                          {t('common.cancel', { defaultValue: 'Cancel' })}
                        </Button>
                      </div>
                    </div>
                  )}

                  {msg.pendingAction?.applied && (
                    <Badge variant="default" className="text-[10px] gap-1 rounded-md">
                      <Check className="h-3 w-3" />
                      {t('staff.teacher.calendar.applied', { defaultValue: 'Applied' })}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>

      {/* ═══ Input area — Zoom-style with subtle divider ═══ */}
      <div className="border-t border-border/50 p-3 bg-card/80 backdrop-blur-sm">
        <p className="text-[10px] text-muted-foreground/60 text-center mb-2">
          {t('staff.teacher.calendar.assistant_disclaimer', { defaultValue: 'AI can make mistakes. Review for accuracy.' })}
        </p>
        <form
          onSubmit={e => { e.preventDefault(); handleSend(); }}
          className="relative flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t('staff.teacher.calendar.assistant_placeholder', { defaultValue: 'Write a message...' })}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-[24px] max-h-[120px] py-0.5 leading-relaxed"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center disabled:opacity-30 hover:opacity-80 transition-opacity"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
