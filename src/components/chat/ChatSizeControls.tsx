import { motion } from 'framer-motion';
import { Minimize2, Maximize2, Square, RectangleHorizontal } from 'lucide-react';
import { ChatSizeMode } from '@/hooks/useChatSize';
import { cn } from '@/lib/utils';

interface ChatSizeControlsProps {
  currentSize: ChatSizeMode;
  onSizeChange: (size: ChatSizeMode) => void;
  className?: string;
}

const sizeIcons: Record<ChatSizeMode, React.ReactNode> = {
  compact: <Minimize2 className="w-3.5 h-3.5" />,
  standard: <Square className="w-3.5 h-3.5" />,
  wide: <RectangleHorizontal className="w-3.5 h-3.5" />,
  full: <Maximize2 className="w-3.5 h-3.5" />,
};

const sizeLabels: Record<ChatSizeMode, string> = {
  compact: 'صغير',
  standard: 'عادي',
  wide: 'واسع',
  full: 'ملء الشاشة',
};

export function ChatSizeControls({ currentSize, onSizeChange, className }: ChatSizeControlsProps) {
  const sizes: ChatSizeMode[] = ['compact', 'standard', 'wide', 'full'];

  return (
    <div className={cn("flex items-center gap-1 bg-muted/50 rounded-lg p-0.5", className)}>
      {sizes.map((size) => (
        <motion.button
          key={size}
          onClick={() => onSizeChange(size)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "p-1.5 rounded-md transition-all duration-200",
            currentSize === size
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title={sizeLabels[size]}
        >
          {sizeIcons[size]}
        </motion.button>
      ))}
    </div>
  );
}

// Compact cycle button for header
export function ChatSizeCycleButton({ 
  currentSize, 
  onCycle,
  className 
}: { 
  currentSize: ChatSizeMode; 
  onCycle: () => void;
  className?: string;
}) {
  return (
    <motion.button
      onClick={onCycle}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={cn(
        "p-1.5 rounded-lg transition-all duration-200",
        "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white",
        className
      )}
      title={`الحجم: ${sizeLabels[currentSize]}`}
    >
      {sizeIcons[currentSize]}
    </motion.button>
  );
}
