import { useState, useEffect, useMemo, useRef } from 'react';
import { useSmartScroll } from '@/hooks/useSmartScroll';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { ChatMessage } from './ChatMessage';
import { UniversityResults } from './UniversityResults';
import { LiveSessionPanel } from './LiveSessionPanel';
import { AIIcon } from '@/components/icons/AIIcon';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Radio, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export function AIChatPanel() {
  const { t } = useLanguage();
  const {
    messages,
    universities,
    status,
    isOpen,
    closeChat,
    addMessage,
  } = useMalakChat();

  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'text' | 'live'>('text');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ✅ Smart Auto-scroll with typewriter support
  const hasNewMessage = useMemo(() => 
    messages.some(m => (m as any).isNew === true),
    [messages]
  );
  
  const { scrollRef, handleScroll } = useSmartScroll({
    messagesCount: messages.length,
    isTyping: status === 'thinking' || status === 'searching',
    hasNewMessage
  });

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || status === 'thinking') return;

    addMessage({
      from: 'user',
      type: 'text',
      content: input.trim(),
    });

    setInput('');

    setTimeout(() => {
      addMessage({
        from: 'bot',
        type: 'text',
        content: t('botUi.quickReply'),
      });
    }, 1000);
  };

  const suggestedPrompts = [
    t('bot.prompt.russia'),
    t('bot.prompt.medicine'),
    t('bot.prompt.scholarship'),
    t('bot.prompt.engineering'),
  ];

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleLikeUniversity = (universityId: string) => {
    addMessage({
      from: 'user',
      type: 'text',
      content: t('botUi.like'),
    });
  };

  const handleRequestAlternatives = () => {
    addMessage({
      from: 'user',
      type: 'text',
      content: t('portal.chat.messages.requestAlternatives'),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeChat()}>
      <SheetContent
        side="bottom"
        className="h-[85vh] sm:h-[70vh] p-0 flex flex-col"
      >
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <AIIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <SheetTitle className="text-lg">{t('bot.name')}</SheetTitle>
              <p className="text-xs text-muted-foreground">{t('bot.intro')}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-6" onScrollCapture={handleScroll}>
            <div ref={scrollRef} className="space-y-4 py-4">
              {messages.length === 0 && (
                <div className="space-y-4 py-8">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">{t('bot.welcome')}</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      {t('bot.intro')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestedPrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        onClick={() => handlePromptClick(prompt)}
                        className="text-xs"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {status === 'thinking' && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                    <AIIcon className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('bot.typing')}</span>
                  </div>
                </div>
              )}

              {status === 'searching' && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                    <AIIcon className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('bot.searching')}</span>
                  </div>
                </div>
              )}
            </div>

            {universities.length > 0 && (
              <div className="pb-4">
                <UniversityResults
                  universities={universities}
                  onLike={handleLikeUniversity}
                  onRequestAlternatives={handleRequestAlternatives}
                />
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t space-y-2">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('portal.chat.placeholders.default')}
                className="min-h-[60px] resize-none"
                disabled={status === 'thinking'}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || status === 'thinking'}
                size="icon"
                className="h-[60px] w-[60px] flex-shrink-0"
              >
                {status === 'thinking' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {t('botUi.sendHint')}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
