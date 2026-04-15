import { useEffect, useMemo, useState } from "react";
import { DSButton } from "@/components/design-system/DSButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { verifyAdminSSOFromURL } from "@/lib/admin.sso";

type Row = { key: string; value: any; updated_at?: string|null };

export default function FeatureSettingsAdmin(){
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string|null>(null);
  const [draft, setDraft] = useState<string>("{}");
  const [err, setErr] = useState<string>("");

  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState('{"enabled": true}');

  const filtered = useMemo(()=>{
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => r.key.toLowerCase().includes(s));
  }, [rows, q]);

  useEffect(() => {
    const init = async () => {
      const { ok } = await verifyAdminSSOFromURL();
      if (!ok) {
        window.location.href = "/";
        return;
      }
      await load();
    };
    init();
  }, []);

  const load = async ()=>{
    setLoading(true);
    const { data, error } = await supabase
      .from("feature_settings")
      .select("key,value,updated_at")
      .order("key", { ascending: true });
    if (error) {
      console.error(error);
      toast({
        title: "Error loading settings",
        description: error.message,
        variant: "destructive"
      });
    }
    setRows(data || []);
    setLoading(false);
  };

  const startEdit = (r: Row)=>{
    setEditingKey(r.key);
    setErr("");
    setDraft(JSON.stringify(r.value ?? {}, null, 2));
  };

  const cancelEdit = ()=>{ setEditingKey(null); setDraft("{}"); setErr(""); };

  const saveEdit = async ()=>{
    if (!editingKey) return;
    try{
      const parsed = JSON.parse(draft);
      const { error } = await supabase
        .from("feature_settings")
        .upsert({ key: editingKey, value: parsed }, { onConflict: "key" });
      if (error) throw error;
      setRows(prev => prev.map(r => r.key===editingKey ? { ...r, value: parsed, updated_at: new Date().toISOString() } : r));
      toast({ title: "Setting updated successfully" });
      cancelEdit();
    }catch(e:any){ 
      setErr(e.message || "Invalid JSON");
      toast({
        title: "Error",
        description: e.message || "Invalid JSON",
        variant: "destructive"
      });
    }
  };

  const del = async (k: string)=>{
    if (!confirm(`Delete setting '${k}'?`)) return;
    const { error } = await supabase.from("feature_settings").delete().eq("key", k);
    if (error) { 
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return; 
    }
    setRows(prev => prev.filter(r => r.key !== k));
    toast({ title: "Setting deleted" });
    if (editingKey===k) cancelEdit();
  };

  const quickToggle = async (r: Row)=>{
    const v = (typeof r.value === "object" && r.value !== null) ? { ...r.value } : {};
    const current = !!(v as any).enabled;
    (v as any).enabled = !current;
    const { error } = await supabase.from("feature_settings").upsert({ key: r.key, value: v }, { onConflict: "key" });
    if (error) { 
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return; 
    }
    setRows(prev => prev.map(x => x.key===r.key ? { ...x, value: v, updated_at: new Date().toISOString() } : x));
    toast({ title: `Setting ${current ? 'disabled' : 'enabled'}` });
  };

  const addNew = async ()=>{
    const key = newKey.trim();
    if (!key) { 
      toast({
        title: "Error",
        description: "Enter a key",
        variant: "destructive"
      });
      return; 
    }
    try{
      const parsed = JSON.parse(newVal);
      const { error } = await supabase.from("feature_settings").insert({ key, value: parsed });
      if (error) throw error;
      setRows(prev => [...prev, { key, value: parsed, updated_at: new Date().toISOString() }].sort((a,b)=>a.key.localeCompare(b.key)));
      setNewKey(""); 
      setNewVal('{"enabled": true}');
      toast({ title: "Setting added successfully" });
    }catch(e:any){ 
      toast({
        title: "Error",
        description: e.message || "Invalid JSON",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <>
        <div className="max-w-6xl mx-auto px-4 py-6">Loading...</div>
      </>
    );
  }

  return (
    <>
      <section className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Feature Settings</h1>

        <div className="space-y-6">
          {/* Search */}
          <div className="flex gap-3">
            <input 
              className="flex-1 border rounded-xl px-4 py-2 bg-background"
              placeholder="Search by key..." 
              value={q} 
              onChange={e=>setQ(e.target.value)} 
            />
            <DSButton onClick={load}>Refresh</DSButton>
          </div>

          {/* Add New Setting */}
          <div className="rounded-xl border bg-background p-6">
            <h2 className="text-lg font-semibold mb-4">Add New Setting</h2>
            <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <input 
                className="border rounded-xl px-4 py-2 bg-background"
                placeholder="key (e.g., voice_bot_enabled)" 
                value={newKey} 
                onChange={e=>setNewKey(e.target.value)} 
              />
              <input 
                className="border rounded-xl px-4 py-2 bg-background font-mono text-sm"
                placeholder='value (JSON)' 
                value={newVal} 
                onChange={e=>setNewVal(e.target.value)} 
              />
              <DSButton onClick={addNew}>Add</DSButton>
            </div>
          </div>

          {/* Settings Table */}
          <div className="rounded-xl border bg-background overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Key</th>
                    <th className="text-left px-4 py-3 font-semibold">Value (Preview)</th>
                    <th className="text-left px-4 py-3 font-semibold">Toggle</th>
                    <th className="text-left px-4 py-3 font-semibold">Updated</th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r=>(
                    <tr key={r.key} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold font-mono text-sm">{r.key}</td>
                      <td className="px-4 py-3 font-mono text-sm max-w-md truncate">
                        {(() => {
                          try { return JSON.stringify(r.value); }
                          catch { return String(r.value); }
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <DSButton 
                          variant="outline" 
                          size="sm"
                          onClick={()=>quickToggle(r)}
                        >
                          {(typeof r.value === "object" && r.value && "enabled" in r.value) 
                            ? (r.value.enabled ? "Disable" : "Enable") 
                            : "Toggle"}
                        </DSButton>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <DSButton 
                          variant="outline" 
                          size="sm"
                          onClick={()=>startEdit(r)}
                        >
                          Edit JSON
                        </DSButton>
                        <DSButton 
                          variant="outline" 
                          size="sm"
                          onClick={()=>del(r.key)}
                          className="text-destructive hover:text-destructive"
                        >
                          Delete
                        </DSButton>
                      </td>
                    </tr>
                  ))}
                  {filtered.length===0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No settings found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* JSON Editor */}
          {editingKey && (
            <div className="rounded-xl border bg-background p-6">
              <h3 className="text-lg font-semibold mb-4">
                Edit: <span className="font-mono text-primary">{editingKey}</span>
              </h3>
              <textarea
                value={draft}
                onChange={e=>{ setDraft(e.target.value); setErr(""); }}
                className="w-full min-h-[240px] border rounded-xl px-4 py-2 bg-background font-mono text-sm"
              />
              {err && (
                <div className="mt-2 text-destructive text-sm">Error: {err}</div>
              )}
              <div className="mt-4 flex gap-3">
                <DSButton onClick={saveEdit}>Save</DSButton>
                <DSButton variant="outline" onClick={cancelEdit}>Cancel</DSButton>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
