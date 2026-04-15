/**
 * TeacherProfileAiFill — AI chat assistant that helps teachers fill their profile.
 * Streams responses and extracts tool calls to suggest field values.
 */
import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, Sparkles, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface ProfileFields {
  display_name?: string;
  bio?: string;
  teaching_experience?: string;
  education?: string;
  specialty?: string;
  languages_spoken?: string[];
  country?: string;
  country_code?: string;
  price_per_lesson?: number;
  lesson_duration_minutes?: number;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface Suggestion {
  fields: ProfileFields;
  accepted: boolean | null; // null = pending
}

interface Props {
  currentProfile: ProfileFields;
  onApplySuggestion: (fields: ProfileFields) => void;
}

const FIELD_LABELS: Record<string, string> = {
  display_name: 'Display Name',
  bio: 'About Me',
  teaching_experience: 'Teaching Experience',
  education: 'Education',
  specialty: 'Specialty',
  languages_spoken: 'Languages Spoken',
  country: 'Country',
  country_code: 'Country Code',
  price_per_lesson: 'Price/Lesson',
  lesson_duration_minutes: 'Duration',
};

export function TeacherProfileAiFill({ currentProfile, onApplySuggestion }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    scrollToBottom();

    let assistantContent = '';
    let toolCallArgs = '';
    let hasToolCall = false;

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/teacher-profile-ai-fill`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            currentProfile,
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        throw new Error('Failed to connect to AI');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            // Text content
            if (delta.content) {
              assistantContent += delta.content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
              scrollToBottom();
            }

            // Tool call
            if (delta.tool_calls) {
              hasToolCall = true;
              for (const tc of delta.tool_calls) {
                if (tc.function?.arguments) {
                  toolCallArgs += tc.function.arguments;
                }
              }
            }
          } catch {
            // partial JSON, continue
          }
        }
      }

      // Process tool call result
      if (hasToolCall && toolCallArgs) {
        try {
          const fields = JSON.parse(toolCallArgs) as ProfileFields;
          // Filter out empty values
          const cleaned: ProfileFields = {};
          for (const [k, v] of Object.entries(fields)) {
            if (v !== null && v !== undefined && v !== '') {
              (cleaned as any)[k] = v;
            }
          }
          if (Object.keys(cleaned).length > 0) {
            setSuggestions(prev => [...prev, { fields: cleaned, accepted: null }]);
            // Add assistant note about suggestion
            const suggestionNote = t('staff.teacher.profile.ai.suggestionReady', {
              defaultValue: '✨ I have suggestions ready for your profile fields. Review them below!',
            });
            if (!assistantContent) {
              setMessages(prev => [...prev, { role: 'assistant', content: suggestionNote }]);
            }
            scrollToBottom();
          }
        } catch (e) {
          console.warn('Failed to parse tool call args:', e);
        }
      }

      // If no content and no tool call
      if (!assistantContent && !hasToolCall) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: t('staff.teacher.profile.ai.noResponse', { defaultValue: 'I couldn\'t generate a response. Please try again.' }),
        }]);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('staff.teacher.profile.ai.error', { defaultValue: 'An error occurred. Please try again.' }),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, currentProfile, t]);

  const acceptSuggestion = (index: number) => {
    const s = suggestions[index];
    if (!s || s.accepted !== null) return;
    onApplySuggestion(s.fields);
    setSuggestions(prev => prev.map((sg, i) => i === index ? { ...sg, accepted: true } : sg));
  };

  const rejectSuggestion = (index: number) => {
    setSuggestions(prev => prev.map((sg, i) => i === index ? { ...sg, accepted: false } : sg));
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
      >
        <Sparkles className="h-4 w-4" />
        {t('staff.teacher.profile.ai.fillWithAi', { defaultValue: 'Fill with AI Assistant' })}
      </Button>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold">
              {t('staff.teacher.profile.ai.title', { defaultValue: 'AI Profile Assistant' })}
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('staff.teacher.profile.ai.hint', {
            defaultValue: 'Tell me about yourself, your teaching background, and what you teach. I\'ll help fill in your profile fields.',
          })}
        </p>

        {/* Chat messages */}
        <div className="max-h-64 overflow-y-auto space-y-2 border border-border rounded-lg p-3 bg-muted/30">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t('staff.teacher.profile.ai.startChat', {
                defaultValue: 'Start by telling me about your teaching experience...',
              })}
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'text-sm rounded-lg px-3 py-2 max-w-[85%]',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground ms-auto'
                  : 'bg-card border border-border'
              )}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('staff.teacher.profile.ai.thinking', { defaultValue: 'Thinking...' })}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestions */}
        {suggestions.filter(s => s.accepted === null).map((s, idx) => (
          <div key={idx} className="border border-primary/20 rounded-lg p-3 bg-primary/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {t('staff.teacher.profile.ai.suggestion', { defaultValue: 'Suggested Profile Updates' })}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="default" className="h-7 gap-1 text-xs" onClick={() => acceptSuggestion(idx)}>
                  <Check className="h-3 w-3" />
                  {t('staff.teacher.profile.ai.apply', { defaultValue: 'Apply' })}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => rejectSuggestion(idx)}>
                  <X className="h-3 w-3" />
                  {t('staff.teacher.profile.ai.dismiss', { defaultValue: 'Dismiss' })}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              {Object.entries(s.fields).map(([key, val]) => (
                <div key={key} className="text-xs">
                  <span className="font-medium text-foreground">
                    {t(`staff.teacher.profile.${key}`, { defaultValue: FIELD_LABELS[key] || key })}:
                  </span>{' '}
                  <span className="text-muted-foreground">
                    {Array.isArray(val) ? val.join(', ') : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Accepted badges */}
        {suggestions.filter(s => s.accepted === true).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggestions.filter(s => s.accepted === true).map((_, i) => (
              <Badge key={i} variant="secondary" className="text-xs gap-1">
                <Check className="h-3 w-3" />
                {t('staff.teacher.profile.ai.applied', { defaultValue: 'Applied' })}
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('staff.teacher.profile.ai.placeholder', { defaultValue: 'Type your message...' })}
            autoResize
            maxHeight={100}
            className="flex-1 min-h-[40px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
