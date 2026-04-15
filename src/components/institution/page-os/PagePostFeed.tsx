/**
 * University page post feed — shows published posts for public,
 * all posts for staff with management controls.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, MoreHorizontal, Trash2, Archive, Eye, EyeOff, Clock, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { PagePostComposer } from './PagePostComposer';

interface PagePostFeedProps {
  universityId: string;
  isStaff: boolean;
}

interface PostAttachment {
  url: string;
  type: 'image' | 'video';
  name?: string;
}

interface Post {
  id: string;
  title?: string;
  body: string;
  post_type: string;
  status: string;
  pinned: boolean;
  published_at?: string;
  created_at: string;
  author?: { first_name?: string; last_name?: string };
  attachments?: PostAttachment[];
}

export function PagePostFeed({ universityId, isStaff }: PagePostFeedProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('university-page-manage', {
        body: { action: 'posts.list', university_id: universityId },
      });
      if (!error && data?.ok) setPosts(data.posts || []);
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const updatePost = async (postId: string, updates: Record<string, unknown>) => {
    await supabase.functions.invoke('university-page-manage', {
      body: { action: 'posts.update', university_id: universityId, post_id: postId, ...updates },
    });
    fetchPosts();
  };

  const deletePost = async (postId: string) => {
    await supabase.functions.invoke('university-page-manage', {
      body: { action: 'posts.delete', university_id: universityId, post_id: postId },
    });
    fetchPosts();
  };

  const typeColors: Record<string, string> = {
    news: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    announcement: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    scholarship: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    seats_available: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    event: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    official_update: 'bg-primary/10 text-primary',
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground text-sm">{t('pageOS.common.loading')}</div>;
  }

  return (
    <div className="fb-post-feed">
      {isStaff && <PagePostComposer universityId={universityId} onPostCreated={fetchPosts} />}

      {posts.length === 0 && (
        <div className="fb-post-feed__empty">
          <MessageCircle className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mt-2">{t('pageOS.posts.empty')}</p>
        </div>
      )}

      {posts.map(post => (
        <article key={post.id} className="fb-post-card">
          <div className="fb-post-card__header">
            <div className="fb-post-card__meta">
              <span className="fb-post-card__author">
                {post.author ? `${post.author.first_name || ''} ${post.author.last_name || ''}`.trim() : t('pageOS.posts.unknownAuthor')}
              </span>
              <span className="fb-post-card__date">
                {new Date(post.published_at || post.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="fb-post-card__badges">
              {post.pinned && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Pin className="w-3 h-3" />{t('pageOS.posts.pinned')}
                </Badge>
              )}
              <Badge className={`text-xs ${typeColors[post.post_type] || ''}`}>
                {t(`pageOS.posts.type.${post.post_type}`)}
              </Badge>
              {isStaff && post.status !== 'published' && (
                <Badge variant="outline" className="text-xs gap-1">
                  {post.status === 'draft' && <EyeOff className="w-3 h-3" />}
                  {post.status === 'pending_review' && <Clock className="w-3 h-3" />}
                  {post.status === 'archived' && <Archive className="w-3 h-3" />}
                  {t(`pageOS.posts.status.${post.status}`)}
                </Badge>
              )}
            </div>

            {isStaff && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => updatePost(post.id, { pinned: !post.pinned })}>
                    <Pin className="h-4 w-4 me-2" />
                    {post.pinned ? t('pageOS.posts.unpin') : t('pageOS.posts.pin')}
                  </DropdownMenuItem>
                  {post.status === 'draft' && (
                    <DropdownMenuItem onClick={() => updatePost(post.id, { status: 'published' })}>
                      <Eye className="h-4 w-4 me-2" />{t('pageOS.posts.publish')}
                    </DropdownMenuItem>
                  )}
                  {post.status === 'published' && (
                    <DropdownMenuItem onClick={() => updatePost(post.id, { status: 'archived' })}>
                      <Archive className="h-4 w-4 me-2" />{t('pageOS.posts.archive')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => deletePost(post.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4 me-2" />{t('pageOS.posts.deletePost')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {post.title && <h3 className="fb-post-card__title">{post.title}</h3>}
          <p className="fb-post-card__body">{post.body}</p>

          {/* Attachments */}
          {post.attachments && post.attachments.length > 0 && (
            <div className={`fb-post-card__media ${post.attachments.length === 1 ? 'fb-post-card__media--single' : 'fb-post-card__media--grid'}`}>
              {post.attachments.map((att, i) => (
                att.type === 'video' ? (
                  <video
                    key={i}
                    src={att.url}
                    controls
                    className="rounded-lg w-full max-h-[400px] object-contain bg-black"
                  />
                ) : (
                  <img
                    key={i}
                    src={att.url}
                    alt={att.name || ''}
                    className="rounded-lg w-full max-h-[400px] object-cover cursor-pointer"
                    loading="lazy"
                    onClick={() => window.open(att.url, '_blank')}
                  />
                )
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
