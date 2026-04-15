import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRow = {
  id: string;
  created_at: string;
  user_id?: string|null;
  full_name: string;
  email: string;
  phone?: string|null;
  country_slug?: string|null;
  notes?: string|null;
  status: "new"|"in_review"|"submitted"|"rejected"|"accepted";
  items_count: number;
};

type AppItem = {
  application_id: string;
  university_id: string;
  program_id?: string|null;
  university_name?: string|null;
  program_name?: string|null;
};

export default function ApplicationsAdmin(){
  const [rows,setRows] = useState<AppRow[]>([]);
  const [q,setQ] = useState("");
  const [loading,setLoading] = useState(true);
  const [openId,setOpenId] = useState<string|null>(null);
  const [items,setItems] = useState<AppItem[]>([]);
  const [updating,setUpdating] = useState(false);

  const filtered = useMemo(()=>{
    const s = q.trim().toLowerCase();
    if(!s) return rows;
    return rows.filter(r =>
      r.full_name.toLowerCase().includes(s) ||
      r.email.toLowerCase().includes(s) ||
      (r.country_slug || "").toLowerCase().includes(s) ||
      r.status.toLowerCase().includes(s)
    );
  }, [rows, q]);

  const load = async ()=>{
    setLoading(true);
    // نجلب الطلبات وعدد العناصر لكل طلب
    const { data, error } = await supabase
      .from("applications")
      .select("id,created_at,user_id,full_name,email,phone,country_slug,notes,status")
      .order("created_at", { ascending:false });
    if (error) { console.error(error); setLoading(false); return; }

    // جلب أعداد العناصر مرة واحدة
    const ids = (data||[]).map(r=>r.id);
    let counts:Record<string,number> = {};
    if (ids.length){
      const { data: it } = await supabase
        .from("application_items")
        .select("application_id")
        .in("application_id", ids);
      (it||[]).forEach((r:any)=>{ counts[r.application_id] = (counts[r.application_id] || 0) + 1; });
    }

    const mapped:AppRow[] = (data||[]).map((r:any)=>({
      ...r,
      items_count: counts[r.id] || 0
    }));
    setRows(mapped);
    setLoading(false);
  };

  useEffect(()=>{ load(); }, []);

  const open = async (id:string)=>{
    setOpenId(id); setItems([]);
    // عناصر الطلب + أسماء الجامعة/البرنامج
    const { data, error } = await supabase
      .from("application_items")
      .select("application_id, university_id, program_id, universities(name), programs(title)")
      .eq("application_id", id);
    if (!error && data){
      setItems(data.map((x:any)=>({
        application_id: x.application_id,
        university_id: x.university_id,
        program_id: x.program_id,
        university_name: x.universities?.name || null,
        program_name: x.programs?.title || null
      })));
    }
  };

  const changeStatus = async (id:string, status:AppRow["status"])=>{
    setUpdating(true);
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    setUpdating(false);
    if (error) { alert(error.message); return; }
    setRows(prev=>prev.map(r=>r.id===id? { ...r, status } : r));
  };

  const del = async (id:string)=>{
    if (!confirm("حذف هذا الطلب وكل عناصره؟")) return;
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setRows(prev=>prev.filter(r=>r.id!==id));
    if (openId===id) { setOpenId(null); setItems([]); }
  };

  const Status = ({row}:{row:AppRow})=>{
    return (
      <select value={row.status} disabled={updating}
        onChange={e=>changeStatus(row.id, e.target.value as AppRow["status"])}>
        <option value="new">جديد</option>
        <option value="in_review">قيد المراجعة</option>
        <option value="submitted">تم التقديم</option>
        <option value="accepted">مقبول</option>
        <option value="rejected">مرفوض</option>
      </select>
    );
  };

  return (
    <div className="page" dir="rtl" style={{padding:16}}>
      <h2>لوحة التحكم — الطلبات</h2>
      <div style={{display:"flex",gap:8,margin:"10px 0"}}>
        <input placeholder="بحث (اسم/إيميل/الدولة/الحالة…)" value={q} onChange={e=>setQ(e.target.value)}/>
        <button onClick={load}>تحديث</button>
      </div>

      {loading ? <div>Loading…</div> : (
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th style={{textAlign:"right"}}>الاسم</th>
              <th>البريد</th>
              <th>الهاتف</th>
              <th>الدولة</th>
              <th>العناصر</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>(
              <tr key={r.id} style={{borderTop:"1px solid #eee"}}>
                <td>{r.full_name}</td>
                <td>{r.email}</td>
                <td>{r.phone || "—"}</td>
                <td>{r.country_slug || "—"}</td>
                <td>{r.items_count}</td>
                <td><Status row={r}/></td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td style={{textAlign:"left"}}>
                  <button onClick={()=>open(r.id)}>عرض</button>{" "}
                  <button onClick={()=>del(r.id)} style={{color:"#e53935"}}>حذف</button>
                </td>
              </tr>
            ))}
            {filtered.length===0 && (
              <tr><td colSpan={8} style={{textAlign:"center",color:"#888",padding:12}}>لا نتائج</td></tr>
            )}
          </tbody>
        </table>
      )}

      {openId && (
        <div style={{marginTop:12, border:"1px solid #eee", borderRadius:12, padding:12}}>
          <h3>تفاصيل الطلب #{openId.slice(0,8)}</h3>
          {items.length===0 ? <div>لا عناصر</div> : (
            <ul style={{margin:0, padding:"0 16px"}}>
              {items.map((it,i)=>(
                <li key={i} style={{margin:"6px 0"}}>
                  {it.university_name || it.university_id}
                  {it.program_name ? ` — ${it.program_name}` : ""}
                </li>
              ))}
            </ul>
          )}
          <div style={{marginTop:8}}>
            <button onClick={()=>{ setOpenId(null); setItems([]); }}>إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}
