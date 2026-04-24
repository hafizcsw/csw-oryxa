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
    "ag-card group relative block w-full text-left",
    "bg-[var(--ag-bg)] text-[var(--ag-fg)]",
    // hairline border, AG-style — no heavy outline
    "border border-[color:color-mix(in_srgb,var(--ag-fg)_8%,transparent)]",
    "rounded-[20px] overflow-hidden",
    "shadow-[0_1px_0_0_color-mix(in_srgb,var(--ag-fg)_4%,transparent)_inset]",
    "transition-[transform,border-color,box-shadow] duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)]",
    "hover:-translate-y-[3px]",
    "hover:border-[color:color-mix(in_srgb,var(--ag-fg)_16%,transparent)]",
    "hover:shadow-[0_24px_60px_-32px_color-mix(in_srgb,var(--ag-fg)_28%,transparent)]",
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
