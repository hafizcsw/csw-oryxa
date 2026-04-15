import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { verifyAdminSSOFromURL, requireAdmin } from "@/lib/admin.sso";
import { supabase } from "@/integrations/supabase/client";
import { DSButton } from "@/components/design-system/DSButton";
import { AlertTriangle } from "lucide-react";

type Row = { 
  program_id:string; 
  title:string; 
  university_name:string; 
  country_slug:string|null; 
  degree_slug:string|null; 
  languages:string[]|null; 
  next_intake:string|null; 
  fees:number|null; 
  living:number|null; 
  rank:number|null; 
};

export default function AdminPrograms() {
  const [ok, setOk] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    (async () => {
      const { ok } = await verifyAdminSSOFromURL(); 
      setOk(ok); 
      requireAdmin(ok);
      if (!ok) return;
      
      setLoading(true);
      const { data } = await supabase
        .from("programs_view")
        .select("*")
        .order("university_name",{ascending:true})
        .limit(200);
      
      const mapped = (data||[]).map((r:any)=>({
        program_id:r.program_id, 
        title:r.title, 
        university_name:r.university_name,
        country_slug:r.country_slug, 
        degree_slug:r.degree_slug, 
        languages:r.languages,
        next_intake:r.next_intake, 
        fees:r.annual_fees, 
        living:r.monthly_living, 
        rank:r.ranking
      }));
      setRows(mapped);
      setLoading(false);
    })();
  }, []);

  if (!ok) return null;

  return (
    <>
      <section className="max-w-6xl mx-auto px-4 py-6">
        {/* ⚠️ Deprecation Banner - Program creation moved to University Studio */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-800">صفحة للعرض فقط</h3>
            <p className="text-sm text-amber-700 mt-1">
              تم نقل إنشاء وتعديل البرامج إلى <strong>University Studio</strong>. 
              هذه الصفحة للعرض فقط. لإضافة برنامج جديد، افتح الجامعة المطلوبة ثم اذهب لتبويب "البرامج".
            </p>
            <a 
              href="/admin/universities" 
              className="inline-block mt-2 text-sm font-medium text-amber-700 hover:text-amber-900 underline"
            >
              ← الذهاب لإدارة الجامعات
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Programs (عرض فقط)</h1>
          <div className="flex gap-2">
            <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900 self-center">← Back to Admin</a>
          </div>
        </div>
        
        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>University</Th>
                  <Th>Program</Th>
                  <Th>Degree</Th>
                  <Th>Country</Th>
                  <Th>Lang</Th>
                  <Th>Intake</Th>
                  <Th>Fees</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.program_id} className="border-t hover:bg-gray-50">
                    <Td>{r.university_name}</Td>
                    <Td className="font-medium">{r.title}</Td>
                    <Td>{r.degree_slug?.toUpperCase()||"—"}</Td>
                    <Td>{r.country_slug?.toUpperCase()||"—"}</Td>
                    <Td>{r.languages?.join(", ")||"—"}</Td>
                    <Td>{r.next_intake || "—"}</Td>
                    <Td>{r.fees!=null? `$${r.fees.toLocaleString()}`:"—"}</Td>
                    <Td>
                      <DSButton variant="outline" size="sm" onClick={async ()=>{
                        const token = localStorage.getItem("csw_admin_sso")!;
                        const next_intake = prompt("Next intake (YYYY-MM-DD)?", r.next_intake||"");
                        const languages = prompt("Languages (comma-separated)?", r.languages?.join(",")||"");
                        await supabase.functions.invoke("admin-programs-update", {
                          body: { 
                            id: r.program_id, 
                            next_intake: next_intake || null,
                            languages: languages ? languages.split(",").map(l=>l.trim()) : null
                          },
                          headers: { authorization: `Bearer ${token}` }
                        });
                        location.reload();
                      }}>Edit</DSButton>
                    </Td>
                  </tr>
                ))}
                {rows.length===0 && (
                  <tr>
                    <Td colSpan={7}>
                      <span className="text-gray-500">No programs found. Add data via CRM or use import tools.</span>
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Th({children}:{children:any}){ 
  return <th className="text-left px-3 py-2 font-medium text-gray-600">{children}</th>
}

function Td({children, colSpan, className}:{children:any; colSpan?:number; className?:string}){ 
  return <td colSpan={colSpan} className={`px-3 py-2 ${className||""}`}>{children}</td>
}
