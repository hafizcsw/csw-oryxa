import { WebChatMessage } from '@/types/crm';
import { ChatMessage as LegacyChatMessageType } from '@/types/chat';
import { AIIcon } from '@/components/icons/AIIcon';
import { User, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MarkdownMessage } from '@/components/chat/MarkdownMessage';
import { useTypewriter } from '@/hooks/useTypewriter';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatMessageProps {
  message: WebChatMessage | LegacyChatMessageType;
  onAction?: (action: string) => void;
  isNew?: boolean;
}

export function ChatMessage({ message, onAction, isNew = false }: ChatMessageProps) {
  const { t } = useLanguage();
  const isBot = message.from === 'bot';
  const hasAction = 'action' in message && message.action;

  // Support reply_markdown field + ui_directives
  const content = (message as any).reply_markdown || message.content || "";
  const cps = (message as any).ui_directives?.typing_cps ?? 40;
  const isNewMsg = Boolean((message as any).isNew ?? isNew);

  // Typewriter effect للرسائل الجديدة من البوت فقط
  const { displayedText, isComplete, skipToEnd } = useTypewriter({
    text: content,
    cps,
    enabled: isBot && isNewMsg,
  });

  const renderText = isBot && isNewMsg ? displayedText : content;

  const handleActionClick = () => {
    if (hasAction && onAction) {
      onAction(message.action as string);
    }
  };

  return (
    <div className={cn(
      'flex gap-3 animate-fade-in',
      isBot ? 'justify-start' : 'justify-end'
    )}>

      <div className={cn(
        'max-w-[85%] transition-all duration-300',
        isBot 
          ? 'text-foreground' 
          : 'rounded-2xl rounded-tr-sm px-4 py-3 oryxa-message-user text-foreground'
      )}>
        {isBot ? (
          <div 
            onClick={isNewMsg && !isComplete ? skipToEnd : undefined}
            className={cn(
              "whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground",
              isNewMsg && !isComplete && "cursor-pointer"
            )}
          >
            <MarkdownMessage content={renderText} />
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-[15px] leading-7">
            {content}
          </div>
        )}
        
        {/* Note: Typing indicator removed - unified thinking bubble handles this */}
        
        {/* Action Button - only show when typing is complete */}
        {hasAction && onAction && isComplete && (
          <Button
            onClick={handleActionClick}
            className="mt-3 w-full bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 text-success-foreground font-medium shadow-md"
            size="sm"
          >
            <CheckCircle2 className="w-4 h-4 ml-2" />
            {t('portal.chat.messages.confirmAction')}
          </Button>
        )}
      </div>

    </div>
  );
}
