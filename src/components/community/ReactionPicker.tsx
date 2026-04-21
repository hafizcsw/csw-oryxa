import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { REACTIONS, REACTION_MAP, type ReactionKey } from "./reactionConfig";

interface ReactionPickerProps {
  current: ReactionKey | null;
  count: number;
  isAr: boolean;
  onReact: (r: ReactionKey | null) => void;
}

/**
 * Facebook-style reaction button with hover-to-open emoji picker.
 * - Click toggles "like" or removes current reaction.
 * - Hover (300ms) shows the picker; tap-and-hold on mobile.
 */
export function ReactionPicker({ current, count, isAr, onReact }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setOpen(true), 280);
  };
  const scheduleClose = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  };

  const handleClick = () => {
    onReact(current ? null : 'like');
  };

  const def = current ? REACTION_MAP[current] : null;
  const label = def ? (isAr ? def.labelAr : def.labelEn) : (isAr ? "إعجاب" : "Like");

  return (
    <div
      className="relative flex-1"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={handleClick}
        onTouchStart={() => { holdTimer.current = setTimeout(() => setOpen(true), 350); }}
        onTouchEnd={() => { if (holdTimer.current) clearTimeout(holdTimer.current); }}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors",
          def ? def.color : "text-muted-foreground hover:bg-muted/60",
          !def && "hover:text-foreground"
        )}
      >
        {def ? (
          <span className="text-base leading-none">{def.emoji}</span>
        ) : (
          <ThumbsUp className="w-4 h-4" />
        )}
        <span>{label}</span>
        {count > 0 && <span className="text-xs opacity-70">({count})</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-2 rounded-full bg-card border border-border shadow-2xl"
            onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }}
            onMouseLeave={scheduleClose}
          >
            {REACTIONS.map((r, i) => (
              <motion.button
                key={r.key}
                initial={{ scale: 0, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ delay: i * 0.03, type: "spring", stiffness: 500, damping: 20 }}
                whileHover={{ scale: 1.4, y: -8 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(current === r.key ? null : r.key);
                  setOpen(false);
                }}
                className="text-2xl leading-none p-1 rounded-full transition-transform"
                title={isAr ? r.labelAr : r.labelEn}
              >
                {r.emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
