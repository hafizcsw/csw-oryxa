import { motion } from 'framer-motion';
import { X, History, Plus, Sparkles, Settings } from 'lucide-react';
import { AIIcon } from '@/components/icons/AIIcon';
import { ChatSizeCycleButton } from './ChatSizeControls';
import { ChatSizeMode } from '@/hooks/useChatSize';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface EnhancedChatHeaderProps {
  onClose?: () => void;
  onNewChat?: () => void;
  onToggleHistory?: () => void;
  historyOpen?: boolean;
  sizeMode: ChatSizeMode;
  onCycleSize?: () => void;
  isFullscreen?: boolean;
  className?: string;
}

export function EnhancedChatHeader({
  onClose,
  onNewChat,
  onToggleHistory,
  historyOpen,
  sizeMode,
  onCycleSize,
  isFullscreen,
  className,
}: EnhancedChatHeaderProps) {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center justify-between",
        isMobile ? "px-3 py-2" : "px-4 py-3",
        "bg-card border-b border-border",
        isFullscreen ? "rounded-none" : "rounded-t-2xl",
        className
      )}
      style={isMobile ? { paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' } : undefined}
    >
      {/* Left side - Logo & Title */}
      <div className="flex items-center gap-2">
        {/* History toggle - hidden on mobile/fullscreen */}
        {onToggleHistory && !isMobile && !isFullscreen && (
          <motion.button
            onClick={onToggleHistory}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              historyOpen 
                ? "bg-muted text-foreground" 
                : "bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="w-4 h-4" />
          </motion.button>
        )}

        {/* Logo & Title */}
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className={cn(
              "rounded-xl bg-muted flex items-center justify-center",
              isMobile ? "w-6 h-6" : "w-8 h-8"
            )}
          >
            <Sparkles className={cn("text-primary", isMobile ? "w-3 h-3" : "w-4 h-4")} />
          </motion.div>
          <span className={cn("font-bold text-foreground tracking-wide", isMobile ? "text-xs" : "text-sm")}>
            ORYXA
          </span>
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1.5">
        {/* New Chat - hidden on mobile/fullscreen */}
        {onNewChat && !isMobile && !isFullscreen && (
          <motion.button
            onClick={onNewChat}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
            title={t('portal.chat.controls.newChat')}
          >
            <Plus className="w-4 h-4" />
          </motion.button>
        )}

        {/* Size Control - hidden on mobile/fullscreen */}
        {onCycleSize && !isMobile && !isFullscreen && (
          <ChatSizeCycleButton 
            currentSize={sizeMode} 
            onCycle={onCycleSize}
          />
        )}

        {/* Close */}
        {onClose && (
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.05, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-200",
              isMobile ? "p-2.5" : "p-2"
            )}
          >
            <X className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
          </motion.button>
        )}
      </div>
    </motion.header>
  );
}
