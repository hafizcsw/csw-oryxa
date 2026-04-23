import { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface AGCardProps {
  children: ReactNode;
  media?: ReactNode;
  className?: string;
  index?: number;
  onClick?: () => void;
  href?: string;
}

/**
 * AG-style card: 1px border, 24px radius, soft hover lift.
 * Uses --i for stagger when wrapped in a triptych.
 */
export function AGCard({
  children,
  media,
  className,
  index = 0,
  onClick,
  href,
}: AGCardProps) {
  const style = { ["--i" as string]: index } as CSSProperties;
  const Inner = (
    <>
      {media && (
        <div className="ag-card-media overflow-hidden rounded-t-[var(--ag-radius)] aspect-[4/3] bg-[var(--ag-border)]/40">
          {media}
        </div>
      )}
      <div className="p-6 md:p-7">{children}</div>
    </>
  );

  const cls = cn(
    "ag-card group block w-full text-left",
    "bg-[var(--ag-bg)] text-[var(--ag-fg)]",
    "border border-[var(--ag-border)]",
    "rounded-[var(--ag-radius)] overflow-hidden",
    "transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]",
    "hover:-translate-y-1 hover:shadow-[0_18px_48px_-24px_rgba(15,15,15,0.18)]",
    className
  );

  if (href) {
    return (
      <a href={href} className={cls} style={style}>
        {Inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style}>
        {Inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {Inner}
    </div>
  );
}
