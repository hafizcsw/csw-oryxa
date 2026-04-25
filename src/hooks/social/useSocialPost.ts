import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CreateInput = {
  userId: string;
  content: string;
  files?: File[];
};

export function useCreateSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, content, files }: CreateInput) => {
      const media_urls: string[] = [];
      let media_type: string | null = null;

      if (files && files.length) {
        for (const f of files) {
          const ext = f.name.split(".").pop() || "bin";
          const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("social-media")
            .upload(path, f, { upsert: false, contentType: f.type });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);
          media_urls.push(pub.publicUrl);
          if (!media_type) media_type = f.type.startsWith("video") ? "video" : "image";
        }
      }

      const { data, error } = await supabase
        .from("social_posts")
        .insert({
          user_id: userId,
          content: content || null,
          media_urls: media_urls.length ? media_urls : null,
          media_type,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-feed"] });
      toast.success("تم النشر");
    },
    onError: (e: any) => toast.error(e?.message || "فشل النشر"),
  });
}

export function useDeleteSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-feed"] }),
  });
}
