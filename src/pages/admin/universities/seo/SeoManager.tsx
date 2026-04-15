import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SEOEditor } from "@/components/admin/SEOEditor";
import { toast } from "sonner";

type SeoManagerProps = {
  universityId: string;
};

export default function SeoManager({ universityId }: SeoManagerProps) {
  const [university, setUniversity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUniversity();
  }, [universityId]);

  const loadUniversity = async () => {
    try {
      const { data } = await supabase
        .from("universities")
        .select("*")
        .eq("id", universityId)
        .single();
      setUniversity(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (seoData: any) => {
    const { error } = await supabase
      .from("universities")
      .update(seoData)
      .eq("id", universityId);
    if (error) throw error;
    await loadUniversity();
  };

  if (loading) return <div className="p-4">جاري التحميل...</div>;
  if (!university) return <div className="p-4">لم يتم العثور على الجامعة</div>;

  const siteUrl = window.location.origin;

  return (
    <SEOEditor
      data={university}
      onSave={handleSave}
      entityType="university"
      defaultValues={{
        title: `${university.name} - ${university.city} | CSW`,
        description: `${university.name} في ${university.city}. استكشف البرامج والمنح.`,
        h1: university.name,
        canonicalUrl: `${siteUrl}/university/${universityId}`,
      }}
    />
  );
}
