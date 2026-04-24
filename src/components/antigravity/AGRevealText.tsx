import { ElementType, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface AGRevealTextProps {
  text: string;
  as?: ElementType;
  className?: string;
  /** ms between word reveals */
  stagger?: number;
  /** initial delay in ms before first word */
  delay?: number;
}

/**
 * Splits text into word spans that reveal individually.
 * Animation is gated by a parent with [data-ag-reveal][data-in="true"].
 */
export function AGRevealText({
  text,
  as: Tag = "h2",
  className,
  stagger = 40,
  delay = 0,
}: AGRevealTextProps) {
  const words = text.split(/(\s+)/); // keep whitespace tokens

  return (
    <Tag className={cn("ag-reveal-text", className)}>
      {words.map((w, i) => {
        if (/^\s+$/.test(w)) return <span key={i}>{w}</span>;
        const idx = Math.floor(i / 2);
        const style = {
          ["--ag-word-delay" as string]: `${delay + idx * stagger}ms`,
        } as CSSProperties;
        return (
          <span key={i} className="ag-word" style={style}>
            <span className="ag-word-inner py-[16px]">{w}</span>
          </span>
        );
      })}
    </Tag>
  );
}
