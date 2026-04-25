import { Plus } from "lucide-react";
import { useSocialAuth } from "@/hooks/social/useSocialAuth";

const stories = [
  { name: "أنت", isYou: true },
  { name: "mrbeast" },
  { name: "aljazeera" },
  { name: "groupfazza" },
  { name: "khabib_n" },
  { name: "elonmusk" },
  { name: "dariushso" },
];

export function StoriesRow() {
  const { user } = useSocialAuth();
  const meta: any = user?.user_metadata ?? {};

  return (
    <div className="flex gap-3 px-4 py-4 overflow-x-auto border-b border-[hsl(var(--social-border))] scrollbar-hide">
      {stories.map((s, i) => (
        <button
          key={i}
          className="flex flex-col items-center gap-1 shrink-0 group"
          aria-label={s.name}
        >
          <div className="relative">
            <div
              className={`w-16 h-16 rounded-full p-[2.5px] ${
                s.isYou
                  ? "bg-[hsl(var(--social-border))]"
                  : "bg-[var(--social-story-ring)]"
              }`}
              style={
                !s.isYou
                  ? {
                      background:
                        "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                    }
                  : undefined
              }
            >
              <div className="w-full h-full rounded-full bg-[hsl(var(--social-bg))] p-[2px]">
                <div className="w-full h-full rounded-full bg-[hsl(var(--social-surface))] flex items-center justify-center text-sm font-bold text-[hsl(var(--social-text))]">
                  {s.isYou && meta.avatar_url ? (
                    <img src={meta.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    s.name.slice(0, 2).toUpperCase()
                  )}
                </div>
              </div>
            </div>
            {s.isYou && (
              <div className="absolute bottom-0 right-0 bg-[hsl(var(--social-accent))] rounded-full w-5 h-5 flex items-center justify-center border-2 border-[hsl(var(--social-bg))]">
                <Plus className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <span className="text-xs text-[hsl(var(--social-text))] truncate max-w-[64px]">
            {s.name}
          </span>
        </button>
      ))}
    </div>
  );
}
