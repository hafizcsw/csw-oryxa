import { useState } from "react";

export function FeedTabs({ value, onChange }: { value: "for-you" | "following"; onChange: (v: "for-you" | "following") => void }) {
  return (
    <div className="sticky top-0 z-10 grid grid-cols-2 bg-[hsl(var(--social-bg))]/80 backdrop-blur border-b border-[hsl(var(--social-border))]">
      {(["for-you", "following"] as const).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className="relative py-4 text-[15px] font-bold text-[hsl(var(--social-text))] hover:bg-white/[0.04] transition"
        >
          <span className={value === k ? "" : "text-[hsl(var(--social-muted))]"}>
            {k === "for-you" ? "لك" : "متابَعون"}
          </span>
          {value === k && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 rounded-full bg-[hsl(var(--social-accent))]" />
          )}
        </button>
      ))}
    </div>
  );
}
