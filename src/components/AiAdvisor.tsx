import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
const clamp = (n: number, mi: number, ma: number) => Math.max(mi, Math.min(ma, n));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
type ItemMode = "universities" | "programs";
interface ResultItem {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  logo: string | null;
  _raw?: any;
}
interface ItemCardProps {
  item: ResultItem;
  selected: boolean;
  onToggle: (item: ResultItem) => void;
}
function ItemCard({
  item,
  selected,
  onToggle
}: ItemCardProps) {
  return <div onClick={() => onToggle(item)} className={`cursor-pointer rounded-xl p-3 transition-all duration-150 h-full flex flex-col gap-2 ${selected ? "border-2 border-primary bg-primary/5" : "border border-border bg-card hover:border-primary/50"}`} title={item.title}>
      <div className="flex items-center gap-2.5">
        {item.logo ? <img src={item.logo} alt="" className="w-9 h-9 object-contain rounded-lg bg-background" /> : <div className="w-9 h-9 rounded-lg bg-muted" />}
        <div className="font-bold text-sm text-foreground flex-1 line-clamp-2">
          {item.title}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {item.subtitle}
        {item.meta ? ` • ${item.meta}` : ""}
      </div>
      <div className="mt-auto flex justify-end">
        <span className={`text-xs px-2.5 py-1 rounded-full ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          {selected ? "محدّدة" : "اختر"}
        </span>
      </div>
    </div>;
}
interface Message {
  role: "assistant" | "user";
  text: string;
}
interface AiAdvisorProps {
  buttonLabel?: string;
  defaultMode?: ItemMode;
  showModeToggle?: boolean;
  maxSelect?: number;
  pageSize?: number;
}
export default function AiAdvisor({
  buttonLabel = "افتح مساعد الذكاء الاصطناعي",
  defaultMode = "universities",
  showModeToggle = true,
  maxSelect = 5,
  pageSize = 8
}: AiAdvisorProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ItemMode>(defaultMode);
  const [phase, setPhase] = useState<"chat" | "results">("chat");
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    text: "أهلًا! سأسألك 3 أسئلة قصيرة ثم أقترح لك نتائج مناسبة."
  }]);
  const [answers, setAnswers] = useState({
    country: "",
    degree: "",
    subject: "",
    budget: ""
  });
  const [currentQ, setCurrentQ] = useState(0);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [page, setPage] = useState(0);
  const [fetching, setFetching] = useState(false);
  const scRef = useRef<HTMLDivElement>(null);
  const storageKey = `ai_select_${mode}_ids`;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      return cached ? new Set(JSON.parse(cached)) : new Set();
    } catch {
      return new Set();
    }
  });

  // أسئلة حسب النوع
  const questions = useMemo(() => {
    if (mode === "programs") {
      return [{
        key: "country",
        prompt: "في أي دولة ترغب بالدراسة؟ (UK/DE/TR ...)"
      }, {
        key: "subject",
        prompt: "ما المجال/التخصص؟ (CS/Business/Medicine ...)"
      }, {
        key: "degree",
        prompt: "الدرجة؟ (بكالوريوس/ماجستير/دكتوراه/لغة)"
      }];
    }
    return [{
      key: "country",
      prompt: "في أي دولة ترغب بالدراسة؟ (UK/DE/TR ...)"
    }, {
      key: "degree",
      prompt: "الدرجة؟ (بكالوريوس/ماجستير/دكتوراه/لغة)"
    }, {
      key: "budget",
      prompt: "ميزانيتك التقريبية شهريًا بالدولار؟ (رقم تقريبي)"
    }];
  }, [mode]);
  useEffect(() => {
    if (open && scRef.current) {
      scRef.current.scrollTop = scRef.current.scrollHeight;
    }
  }, [open, messages, results]);

  // عند تغيير النوع نعيد الضبط
  function switchMode(nextMode: ItemMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setPhase("chat");
    setMessages([{
      role: "assistant",
      text: "تمام. سأسألك 3 أسئلة قصيرة."
    }]);
    setAnswers({
      country: "",
      degree: "",
      subject: "",
      budget: ""
    });
    setCurrentQ(0);
    setInput("");
    setResults([]);
    setPage(0);
    setSelectedIds(new Set());
  }
  async function fetchItems({
    append = false
  } = {}) {
    setFetching(true);
    try {
      const payload: any = {
        country: (answers.country || "").toLowerCase().trim(),
        degree: (answers.degree || "").toLowerCase().trim(),
        subject: (answers.subject || "").toLowerCase().trim(),
        limit: pageSize,
        offset: (append ? page + 1 : page) * pageSize
      };
      if (mode === "universities") {
        payload.name = "";
        payload.fees_max = Number(String(answers.budget).replace(/[^\d.]/g, "")) * 12 || undefined;
      }
      const endpoint = mode === "programs" ? "/search-programs" : "/search-universities";
      const data = await api(endpoint, {
        method: "POST",
        body: payload
      });
      const items = Array.isArray(data) ? data : data.items || data.data || [];

      // تطبيع النتائج لعرض موحّد
      const normalized: ResultItem[] = items.map((x: any) => {
        if (mode === "programs") {
          const id = x.id || x.program_id || x.slug || crypto.randomUUID();
          const uni = x.university_name || x.university || x.uni_name || "";
          const degree = x.degree || x.level || "";
          const country = x.country || x.country_name || x.country_slug || "";
          const fee = x.tuition_fee || x.annual_fee || x.fee || null;
          return {
            id,
            title: x.title || x.name || "برنامج",
            subtitle: [uni, country].filter(Boolean).join(" • "),
            meta: [degree, fee ? `${fee} $/y` : ""].filter(Boolean).join(" • "),
            logo: x.logo_url || x.university_logo || x.logo || null,
            _raw: x
          };
        } else {
          const id = x.id || x.slug || x.uni_id || crypto.randomUUID();
          const country = x.country || x.country_name || x.country_slug || "";
          return {
            id,
            title: x.name || x.title || "جامعة",
            subtitle: country || "—",
            meta: x.programs_count ? `برامج ${x.programs_count}` : "",
            logo: x.logo_url || x.logo || x.image || null,
            _raw: x
          };
        }
      });
      setResults(prev => append ? [...prev, ...normalized] : normalized);
      if (!append) setPage(0);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setFetching(false);
    }
  }
  async function sendSelection() {
    const items = results.filter(r => selectedIds.has(r.id)).map(r => ({
      type: mode === "programs" ? "program" : "university",
      id: r.id
    }));
    if (!items.length) return;
    try {
      await api("/bridge-emit", {
        method: "POST",
        body: {
          event: "selection.updated",
          payload: {
            channel: "web",
            items,
            max: maxSelect,
            idempotency_key: `sel:${mode}:${btoa(items.map(i => i.id).join(","))}`
          }
        }
      });
    } catch (error) {
      console.error("Error sending selection:", error);
    }
  }
  function addMessage(role: "assistant" | "user", text: string) {
    setMessages(m => [...m, {
      role,
      text
    }]);
  }
  async function handleUserSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    addMessage("user", text);
    const q = questions[currentQ];
    const nextAnswers = {
      ...answers,
      [q.key]: text
    };
    setAnswers(nextAnswers);
    if (currentQ < questions.length - 1) {
      setCurrentQ(i => i + 1);
      await sleep(150);
      addMessage("assistant", questions[currentQ + 1].prompt);
    } else {
      addMessage("assistant", "تمام — أعددت لك نتائج مناسبة 👇");
      setPhase("results");
      await fetchItems({
        append: false
      });
    }
  }
  function toggleSelect(item: ResultItem) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else if (next.size < maxSelect) {
        next.add(item.id);
      }
      return next;
    });
  }
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(selectedIds)));
    } catch {}
  }, [selectedIds, storageKey]);
  async function finalize() {
    await sendSelection();
    addMessage("assistant", selectedIds.size ? `اخترت ${selectedIds.size} ${mode === "programs" ? "برنامجًا" : "جامعة"}.\nعند الانتهاء اضغط "أكمل في بوابة الطالب" للمقارنة وإكمال المستندات.` : "لم تختر شيئًا بعد — اضغط على البطاقات للاختيار.");
  }

  // تحكم بسيط في الأعمدة حسب العرض
  const [cols, setCols] = useState(4);
  useEffect(() => {
    function recalc() {
      const w = window.innerWidth;
      setCols(w < 640 ? 1 : w < 900 ? 2 : w < 1200 ? 3 : 4);
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);
  return <div className="w-full max-w-7xl mx-auto" dir="rtl">
      <div className="flex justify-center">
        
      </div>

      {open && <div className="mt-4 border border-border rounded-2xl bg-card shadow-xl p-4">
          {/* تبديل النوع */}
          {showModeToggle && <div className="inline-flex border border-border rounded-full overflow-hidden mb-2.5">
              <button onClick={() => switchMode("universities")} className={`px-3.5 py-2 border-none font-semibold transition-colors ${mode === "universities" ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-muted"}`}>
                جامعات
              </button>
              <button onClick={() => switchMode("programs")} className={`px-3.5 py-2 border-none font-semibold transition-colors ${mode === "programs" ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-muted"}`}>
                برامج
              </button>
            </div>}

          <div ref={scRef} className="max-h-64 overflow-auto p-2 bg-muted/30 rounded-xl border border-border">
            {messages.map((m, i) => <div key={i} className={`flex mb-2 ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[90%] px-3 py-2 rounded-xl whitespace-pre-wrap leading-relaxed text-sm ${m.role === "assistant" ? "bg-card text-foreground border border-border" : "bg-primary text-primary-foreground"}`}>
                  {m.text}
                </div>
              </div>)}
          </div>

          {phase === "chat" && <div className="flex gap-2 mt-2.5">
              <input value={input} onChange={e => setInput(e.target.value)} placeholder={questions[currentQ]?.prompt} className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" onKeyDown={e => e.key === "Enter" && handleUserSend()} />
              <button onClick={handleUserSend} className="bg-foreground text-background rounded-xl px-4 py-2.5 border-none font-medium hover:opacity-90 transition-opacity">
                إرسال
              </button>
            </div>}

          {phase === "results" && <div className="mt-3.5">
              <div className="flex justify-between items-center mb-2">
                <div className="font-bold text-foreground">
                  {mode === "programs" ? "برامج مقترحة" : "جامعات مقترحة"}
                </div>
                <div className="text-xs text-muted-foreground">
                  يمكنك اختيار حتى {maxSelect} — مختار: {clamp(selectedIds.size, 0, maxSelect)}
                </div>
              </div>

              <div className="grid gap-3" style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
        }}>
                {results.slice(0, (page + 1) * pageSize).map(item => <ItemCard key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={toggleSelect} />)}
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={async () => {
            setPage(p => p + 1);
            await fetchItems({
              append: true
            });
          }} disabled={fetching} className="border border-border bg-card rounded-xl px-4 py-2.5 hover:bg-accent transition-colors disabled:opacity-50">
                  {fetching ? "..." : "إظهار المزيد"}
                </button>

                <button onClick={finalize} className="bg-green-600 text-white rounded-xl px-4 py-2.5 border-none hover:bg-green-700 transition-colors font-medium">
                  تم
                </button>
              </div>
            </div>}
        </div>}
    </div>;
}