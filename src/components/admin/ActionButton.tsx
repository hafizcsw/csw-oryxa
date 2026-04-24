import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  variant?: "default" | "primary" | "success" | "warning";
}

export function ActionButton({ label, onClick, disabled, icon: Icon, variant = "default" }: ActionButtonProps) {
  const variants = {
    default: "bg-transparent border-[var(--ag-border)] hover:border-[color:color-mix(in_srgb,var(--ag-fg)_30%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ag-fg)_4%,transparent)] text-[var(--ag-fg)]",
    primary: "bg-[var(--ag-fg)] text-[var(--ag-bg)] border-[var(--ag-fg)] shadow-[0_4px_14px_-2px_hsl(var(--primary)/0.35)] hover:shadow-[0_6px_22px_-4px_hsl(var(--primary)/0.55)] hover:opacity-95",
    success: "bg-gradient-to-r from-success to-success/85 text-success-foreground border-success/20 shadow-[0_4px_14px_-2px_hsl(var(--success)/0.4)] hover:shadow-[0_6px_20px_-2px_hsl(var(--success)/0.55)] hover:brightness-110",
    warning: "bg-[color:color-mix(in_srgb,var(--ag-fg)_8%,transparent)] text-[var(--ag-fg)] border-[var(--ag-border)] hover:bg-[color:color-mix(in_srgb,var(--ag-fg)_14%,transparent)]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 font-bold text-sm tracking-wide transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-50 disabled:hover:translate-y-0",
        variants[variant]
      )}
    >
      {Icon && (
        <Icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
      )}
      <span>{label}</span>
    </button>
  );
}
