import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSocialLike(postId: string, userId: string | null, initialCount: number) {
  const qc = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("social_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [postId, userId]);

  const m = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("not_authed");
      if (liked) {
        await supabase.from("social_likes").delete().eq("post_id", postId).eq("user_id", userId);
      } else {
        await supabase.from("social_likes").insert({ post_id: postId, user_id: userId });
      }
    },
    onMutate: () => {
      setLiked((v) => !v);
      setCount((c) => c + (liked ? -1 : 1));
    },
    onError: () => {
      setLiked((v) => !v);
      setCount((c) => c + (liked ? 1 : -1));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-feed"] }),
  });

  return { liked, count, toggle: () => m.mutate(), pending: m.isPending };
}
