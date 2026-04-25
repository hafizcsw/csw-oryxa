import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SocialComment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  author_name?: string | null;
  author_avatar?: string | null;
};

export function useSocialComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["social-comments", postId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_comments")
        .select("*")
        .eq("post_id", postId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const comments = (data ?? []) as unknown as SocialComment[];
      const ids = Array.from(new Set(comments.map((c) => c.author_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_storage_path")
          .in("user_id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        for (const c of comments) {
          const pr: any = map.get(c.author_id);
          c.author_name = pr?.full_name ?? null;
          c.author_avatar = pr?.avatar_storage_path ?? null;
        }
      }
      return comments;
    },
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, content }: { userId: string; content: string }) => {
      const { error } = await supabase
        .from("social_comments")
        .insert({ post_id: postId, author_id: userId, content });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-comments", postId] });
      qc.invalidateQueries({ queryKey: ["social-feed"] });
    },
  });
}
