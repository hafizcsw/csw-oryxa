import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Flags = Record<string, any>;

function RowToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function RowNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 py-2">
      <span className="min-w-[180px] text-sm">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value || 0))}
        className="w-[120px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
    </label>
  );
}

export default function FeatureFlagsPage() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [flags, setFlags] = useState<Flags>({});
  const [busy, setBusy] = useState(false);

  if (authLoading) {
    return <div className="container mx-auto max-w-4xl px-4 py-6">جاري التحميل...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  async function load() {
    const keys = [
      "crm_enabled", "whatsapp_enabled", "voice_bot_enabled",
      "bot.reply_compact", "ai.gpt_fallback_cap_per_24h",
      "kb_top_k", "kb_min_score", "ingestion_bot_enabled"
    ];

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase.functions.invoke('admin-flags-list', {
      body: { keys: keys.join(",") },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      toast.error("فشل تحميل الأعلام");
      console.error(error);
      return;
    }

    setFlags(data?.flags || {});
  }

  useEffect(() => {
    load();
  }, []);

  async function saveOne(key: string, value: any) {
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("غير مصرح");
      setBusy(false);
      return;
    }

    const { error } = await supabase.functions.invoke('admin-flags-upsert', {
      body: { key, value },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      toast.error("فشل الحفظ");
      console.error(error);
    } else {
      toast.success("تم الحفظ");
      load();
    }
    setBusy(false);
  }

  // Helpers: get with defaults
  const crm = flags["crm_enabled"] ?? { enabled: false, max_retries: 5, timeout_ms: 5000 };
  const wa = flags["whatsapp_enabled"] ?? { enabled: false, rate_per_min: 10, daily_quota: 200 };
  const voice = flags["voice_bot_enabled"] ?? { enabled: false };
  const compact = flags["bot.reply_compact"] ?? { value: true };
  const gptCap = flags["ai.gpt_fallback_cap_per_24h"] ?? { value: 0 };
  const kbTopK = flags["kb_top_k"] ?? { value: 3 };
  const kbMin = flags["kb_min_score"] ?? { value: 0.65 };
  const ingest = flags["ingestion_bot_enabled"] ?? { enabled: true };

  return (
    <div dir="rtl" className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Feature Flags</h1>
      
      <div className="card bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-4">التكاملات (Integrations)</h3>
          
          <RowToggle
            label="CRM Enabled"
            checked={!!crm.enabled}
            onChange={v => saveOne("crm_enabled", { ...crm, enabled: v })}
          />
          <div className="flex gap-4 mr-6 mb-4">
            <RowNumber
              label="CRM max_retries"
              value={crm.max_retries ?? 5}
              onChange={v => saveOne("crm_enabled", { ...crm, max_retries: v })}
            />
            <RowNumber
              label="CRM timeout_ms"
              value={crm.timeout_ms ?? 5000}
              onChange={v => saveOne("crm_enabled", { ...crm, timeout_ms: v })}
            />
          </div>

          <RowToggle
            label="WhatsApp Enabled"
            checked={!!wa.enabled}
            onChange={v => saveOne("whatsapp_enabled", { ...wa, enabled: v })}
          />
          <div className="flex gap-4 mr-6 mb-4">
            <RowNumber
              label="WA rate_per_min"
              value={wa.rate_per_min ?? 10}
              onChange={v => saveOne("whatsapp_enabled", { ...wa, rate_per_min: v })}
            />
            <RowNumber
              label="WA daily_quota"
              value={wa.daily_quota ?? 200}
              onChange={v => saveOne("whatsapp_enabled", { ...wa, daily_quota: v })}
            />
          </div>

          <RowToggle
            label="Voice Bot Enabled"
            checked={!!voice.enabled}
            onChange={v => saveOne("voice_bot_enabled", { ...voice, enabled: v })}
          />
        </div>

        <hr className="border-gray-200" />

        <div>
          <h3 className="text-xl font-semibold mb-4">المساعد الذكي وقاعدة المعرفة (Assistant & KB)</h3>
          
          <RowToggle
            label="Reply Compact (bot.reply_compact)"
            checked={!!compact.value}
            onChange={v => saveOne("bot.reply_compact", { value: v })}
          />
          
          <RowNumber
            label="GPT Fallback Cap / 24h"
            value={gptCap.value ?? 0}
            onChange={v => saveOne("ai.gpt_fallback_cap_per_24h", { value: v })}
          />
          
          <div className="flex gap-4">
            <RowNumber
              label="KB top_k"
              value={kbTopK.value ?? 3}
              onChange={v => saveOne("kb_top_k", { value: v })}
            />
            <RowNumber
              label="KB min_score"
              value={kbMin.value ?? 0.65}
              onChange={v => saveOne("kb_min_score", { value: v })}
            />
          </div>
        </div>

        <hr className="border-gray-200" />

        <div>
          <h3 className="text-xl font-semibold mb-4">بوت جمع البيانات (Ingestion Bot)</h3>
          
          <RowToggle
            label="Enable University Ingestion Bot"
            checked={!!ingest.enabled}
            onChange={v => saveOne("ingestion_bot_enabled", { ...ingest, enabled: v })}
          />
        </div>

        <div className="pt-4">
          <button
            className="btn px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            disabled={busy}
            onClick={load}
          >
            تحديث (Refresh)
          </button>
        </div>
      </div>
    </div>
  );
}
