import { Search, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";

const trending = [
  { topic: "#الجامعات_العالمية", posts: "12.4K منشور" },
  { topic: "#منح_دراسية", posts: "8.1K منشور" },
  { topic: "#ORX", posts: "3.2K منشور" },
  { topic: "#طلاب_دوليون", posts: "5.7K منشور" },
];

export function RightRail() {
  return (
    <aside className="hidden lg:flex flex-col w-[320px] shrink-0 sticky top-0 h-screen py-4 px-4 gap-4 overflow-y-auto">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--social-muted))]" />
        <Input
          placeholder="ابحث"
          className="pl-10 ps-10 h-11 rounded-full bg-[hsl(var(--social-surface))] border-transparent focus-visible:bg-transparent focus-visible:border-[hsl(var(--social-accent))]"
        />
      </div>

      <section className="rounded-2xl bg-[hsl(var(--social-surface))] p-4">
        <h2 className="text-xl font-black mb-3 text-[hsl(var(--social-text))] flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[hsl(var(--social-accent))]" />
          الأكثر تداولاً
        </h2>
        <div className="-mx-4">
          {trending.map((t) => (
            <div
              key={t.topic}
              className="px-4 py-3 hover:bg-white/5 cursor-pointer transition"
            >
              <div className="text-xs text-[hsl(var(--social-muted))]">رائج الآن</div>
              <div className="font-bold text-[hsl(var(--social-text))]">{t.topic}</div>
              <div className="text-xs text-[hsl(var(--social-muted))]">{t.posts}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-[hsl(var(--social-surface))] p-4">
        <h2 className="text-xl font-black mb-3 text-[hsl(var(--social-text))]">
          مقترحون للمتابعة
        </h2>
        <div className="text-sm text-[hsl(var(--social-muted))]">
          سيظهر هنا أشخاص قد تهتم بمتابعتهم.
        </div>
      </section>

      <div className="text-xs text-[hsl(var(--social-muted))] px-2 leading-relaxed">
        © {new Date().getFullYear()} ORX Social · الشروط · الخصوصية · ملفات الارتباط
      </div>
    </aside>
  );
}
