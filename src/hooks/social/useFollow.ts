import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFollow(targetUserId: string, viewerId: string | null) {
  const qc = useQueryClient();
  const key = ["social-follow", targetUserId, viewerId ?? "anon"];

  const q = useQuery({
    queryKey: key,
    enabled: !!viewerId && !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("social_follows")
        .select("id")
        .eq("follower_id", viewerId!)
        .eq("following_id", targetUserId)
        .maybeSingle();
      return !!data;
    },
  });

  const m = useMutation({
    mutationFn: async () => {
      if (!viewerId) throw new Error("not_authed");
      if (q.data) {
        await supabase
          .from("social_follows")
          .delete()
          .eq("follower_id", viewerId)
          .eq("following_id", targetUserId);
      } else {
        await supabase
          .from("social_follows")
          .insert({ follower_id: viewerId, following_id: targetUserId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { isFollowing: !!q.data, toggle: () => m.mutate(), pending: m.isPending };
}
