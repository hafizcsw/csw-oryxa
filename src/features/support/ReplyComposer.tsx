import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';

interface ReplyComposerProps {
  onSend: (body: string) => Promise<unknown>;
  disabled?: boolean;
  sending?: boolean;
}

export function ReplyComposer({ onSend, disabled, sending }: ReplyComposerProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || disabled || sending) return;
    try {
      await onSend(trimmed);
      setBody('');
    } catch {
      // upstream surfaces the error
    }
  };

  return (
    <div className="border-t border-border bg-card p-3">
      <div className="flex gap-2 items-end">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            disabled
              ? t('support.composer.disabled', { defaultValue: 'This case is closed.' })
              : t('support.composer.placeholder', { defaultValue: 'Write a reply…' })
          }
          disabled={disabled || sending}
          rows={2}
          className="resize-none flex-1"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
        />
        <Button
          type="button"
          onClick={submit}
          disabled={disabled || sending || !body.trim()}
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          aria-label={t('support.composer.send', { defaultValue: 'Send' })}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
