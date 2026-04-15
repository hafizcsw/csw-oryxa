import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InlineCellProps = {
  value: string | number | null;
  type?: "text" | "number" | "date";
  onSave: (value: any) => Promise<void>;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
};

export function InlineCell({
  value,
  type = "text",
  onSave,
  placeholder,
  className,
  min,
  max,
  step,
}: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value?.toString() || "");
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = async () => {
    if (localValue === (value?.toString() || "")) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const finalValue =
        type === "number" && localValue
          ? Number(localValue)
          : localValue || null;
      
      await onSave(finalValue);
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
      setLocalValue(value?.toString() || "");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    
    // Auto-save after 600ms of no typing
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (newValue !== (value?.toString() || "")) {
        handleSave();
      }
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setLocalValue(value?.toString() || "");
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className={cn(
          "cursor-pointer hover:bg-muted/50 px-2 py-1 rounded min-h-[2rem] flex items-center",
          saved && "bg-green-50 dark:bg-green-950/20",
          className
        )}
      >
        {saved ? (
          <Check className="h-4 w-4 text-green-600 ml-1" />
        ) : null}
        <span className={!value ? "text-muted-foreground" : ""}>
          {value || placeholder || "—"}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-1">
      <Input
        ref={inputRef}
        type={type}
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        placeholder={placeholder}
        className={cn("h-8", className)}
        min={min}
        max={max}
        step={step}
        disabled={saving}
      />
      {saving && <Loader2 className="h-4 w-4 animate-spin absolute left-2" />}
    </div>
  );
}
