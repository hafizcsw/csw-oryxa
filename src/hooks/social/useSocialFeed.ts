import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SocialPost = {
  id: string;
  author_id: string;
  content: string | null;
  media_urls: string[];
  post_type: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  visibility: string;
  is_deleted: boolean;
  author_name?: string | null;
  author_avatar?: string | null;
};

const PAGE = 20;

async function fetchPage({ pageParam = 0, authorId }: { pageParam?: number; authorId?: string }) {
  let q = supabase
    .from("social_posts")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range(pageParam * PAGE, pageParam * PAGE + PAGE - 1);
  if (authorId) q = q.eq("author_id", authorId);
  const { data, error } = await q;
  if (error) throw error;

  const posts = (data ?? []) as unknown as SocialPost[];
  const ids = Array.from(new Set(posts.map((p) => p.author_id)));
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_storage_path")
      .in("user_id", ids);
    const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    for (const p of posts) {
      const pr: any = map.get(p.author_id);
      p.author_name = pr?.full_name ?? null;
      p.author_avatar = pr?.avatar_storage_path ?? null;
    }
  }
  return { posts, next: posts.length === PAGE ? pageParam + 1 : undefined };
}

export function useSocialFeed(authorId?: string) {
  const qc = useQueryClient();
  const key = ["social-feed", authorId ?? "all"];

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage({ pageParam: pageParam as number, authorId }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.next,
  });

  useEffect(() => {
    const ch = supabase
      .channel("social-posts-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "social_posts" },
        () => qc.invalidateQueries({ queryKey: key })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId]);

  return query;
}
