import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItemProps {
  label: string;
  done: boolean;
  critical?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ChecklistItem({ 
  label, 
  done, 
  critical = false, 
  onClick,
  className 
}: ChecklistItemProps) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200",
        onClick && "cursor-pointer hover:bg-muted/50",
        done && "bg-primary/5",
        !done && critical && "bg-destructive/5",
        className
      )}
      onClick={onClick}
      whileHover={onClick ? { x: 4 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="h-5 w-5 rounded-full bg-primary flex items-center justify-center"
          >
            <Check className="h-3 w-3 text-primary-foreground" />
          </motion.div>
        ) : critical ? (
          <motion.div
            key="critical"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="h-5 w-5 rounded-full bg-destructive/20 flex items-center justify-center"
          >
            <AlertTriangle className="h-3 w-3 text-destructive" />
          </motion.div>
        ) : (
          <motion.div
            key="pending"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center"
          >
            <Circle className="h-2 w-2 text-muted-foreground/30" />
          </motion.div>
        )}
      </AnimatePresence>
      
      <span className={cn(
        "text-sm transition-colors",
        done && "text-muted-foreground",
        !done && critical && "font-medium text-foreground",
        !done && !critical && "text-foreground"
      )}>
        {label}
      </span>
      
      {critical && !done && (
        <motion.span 
          className="mr-auto text-xs text-destructive font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          مطلوب
        </motion.span>
      )}
      
      {onClick && !done && (
        <motion.span 
          className="mr-auto text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity"
          whileHover={{ x: 2 }}
        >
          ←
        </motion.span>
      )}
    </motion.li>
  );
}
