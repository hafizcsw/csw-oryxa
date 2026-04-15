/**
 * Public-facing university post feed — Facebook-style post cards.
 * Real reactions, real comments, relative timestamps, avatar support.
 * Staff members see edit/delete/pin/archive controls inline.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, MessageCircle, Globe, Send, Loader2, ThumbsUp, Share2, MoreHorizontal, Trash2, Archive, Eye, EyeOff, Clock, Edit3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PublicPostFeedProps {
  universityId: string;
  canRefresh?: boolean;
  universityName?: string;
  logoUrl?: string | null;
}

interface PublicPost {
  id: string;
  title?: string;
  body: string;
  post_type: string;
  pinned: boolean;
  status: string;
  published_at: string;
  created_at?: string;
  attachments?: Array<{ url: string; type: string; name?: string }>;
  author?: { full_name?: string; avatar_storage_path?: string | null };
  reaction_counts: Record<string, number>;
  comment_count: number;
  my_reaction: string | null;
}

interface PostComment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  reply_as_university: boolean;
  visible?: boolean;
  profile?: { full_name?: string; avatar_storage_path?: string | null } | null;
}

const typeColors: Record<string, string> = {
  news: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  announcement: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  scholarship: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  seats_available: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  event: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  application_deadline: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  official_update: 'bg-primary/10 text-primary',
};

const REACTION_TYPES = [
  { key: 'like', label: 'Like', color: 'text-blue-500', emoji: '👍', animClass: 'animate-[bounce_0.4s_ease-in-out]' },
  { key: 'love', label: 'Love', color: 'text-red-500', emoji: '❤️', animClass: 'animate-[pulse_0.5s_ease-in-out]' },
  { key: 'care', label: 'Care', color: 'text-amber-500', emoji: '🥰', animClass: 'animate-[bounce_0.4s_ease-in-out]' },
  { key: 'haha', label: 'Haha', color: 'text-amber-500', emoji: '😆', animClass: 'animate-[bounce_0.4s_ease-in-out]' },
  { key: 'wow', label: 'Wow', color: 'text-amber-500', emoji: '😮', animClass: 'animate-[pulse_0.5s_ease-in-out]' },
  { key: 'sad', label: 'Sad', color: 'text-amber-500', emoji: '😢', animClass: 'animate-[pulse_0.5s_ease-in-out]' },
  { key: 'angry', label: 'Angry', color: 'text-orange-600', emoji: '😡', animClass: 'animate-[bounce_0.4s_ease-in-out]' },
];

// ── Relative time ──
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Direct fetch via supabase client ──
import { supabase as supabaseClient } from '@/integrations/supabase/client';

async function invokePageManage(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabaseClient.functions.invoke('university-page-manage', { body });
  if (error) throw error;
  return data;
}

function getProfileName(profile?: { full_name?: string } | null): string {
  return profile?.full_name?.trim() || '';
}

function getInitial(name: string): string {
  return name ? name[0]?.toUpperCase() : '?';
}

// ── Brand SVG icons for share channels ──
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
);
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
);
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
);
const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0 12 12 0 0011.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
);
const EmailIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
);
const CopyLinkIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
);
const RedditIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.462.342.342 0 00-.461 0c-.545.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.206-.096z"/></svg>
);

const SHARE_CHANNELS = [
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon, bg: '#1877F2', getUrl: (url: string, text: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { key: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon, bg: '#25D366', getUrl: (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}` },
  { key: 'twitter', label: 'X', Icon: XIcon, bg: '#000000', getUrl: (url: string, text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedInIcon, bg: '#0A66C2', getUrl: (url: string, text: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { key: 'telegram', label: 'Telegram', Icon: TelegramIcon, bg: '#26A5E4', getUrl: (url: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon, bg: '#E4405F', getUrl: (url: string, text: string) => `https://www.instagram.com/` },
  { key: 'reddit', label: 'Reddit', Icon: RedditIcon, bg: '#FF4500', getUrl: (url: string, text: string) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}` },
  { key: 'email', label: 'Email', Icon: EmailIcon, bg: '#6B7280', getUrl: (url: string, text: string) => `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}` },
];

function SharePopoverContent({ postTitle, postBody, universityName, onClose }: {
  postTitle?: string;
  postBody: string;
  universityName?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const shareText = postTitle || postBody.slice(0, 120) || universityName || '';
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: t('pageOS.share.copied', 'Link copied!') });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t('pageOS.share.copyFailed', 'Copy failed'), variant: 'destructive' });
    }
  };

  const handleShare = (channel: typeof SHARE_CHANNELS[0]) => {
    window.open(channel.getUrl(shareUrl, shareText), '_blank', 'noopener,noreferrer,width=600,height=500');
    onClose();
  };

  return (
    <div className="w-[280px]">
      <p className="text-xs font-semibold text-center pb-2 text-foreground">
        {t('pageOS.share.title', 'Share this post')}
      </p>

      {/* Channel grid */}
      <div className="grid grid-cols-4 gap-2 justify-items-center">
        {SHARE_CHANNELS.map(ch => (
          <button
            key={ch.key}
            onClick={() => handleShare(ch)}
            className="group flex flex-col items-center gap-0.5 transition-transform duration-150 hover:scale-110 active:scale-95"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-shadow group-hover:shadow-md"
              style={{ backgroundColor: ch.bg }}
            >
              <ch.Icon />
            </div>
            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
              {ch.label}
            </span>
          </button>
        ))}
      </div>

      {/* Copy link button */}
      <div className="flex justify-center mt-2">
        <Button
          size="sm"
          variant={copied ? 'default' : 'outline'}
          className="h-7 px-3 text-[10px] rounded-full gap-1"
          onClick={handleCopyLink}
        >
          <CopyLinkIcon />
          {copied
            ? t('pageOS.share.copied', 'Copied!')
            : t('pageOS.share.copyLink', 'Copy Link')}
        </Button>
      </div>
    </div>
  );
}

// ── Reaction summary row ──
function ReactionSummary({ counts, commentCount, onOpenComments }: {
  counts?: Record<string, number> | null;
  commentCount: number;
  onOpenComments: () => void;
}) {
  const safeCounts = counts || {};
  const total = Object.values(safeCounts).reduce((a, b) => a + b, 0);
  if (total === 0 && commentCount === 0) return null;

  const topReactions = Object.entries(safeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="flex items-center justify-between px-4 py-1.5 text-xs text-muted-foreground">
      {total > 0 ? (
        <div className="flex items-center gap-1">
          <span className="flex -space-x-0.5">
            {topReactions.map(([type]) => {
              const r = REACTION_TYPES.find(rt => rt.key === type);
              return r ? <span key={type} className="text-sm">{r.emoji}</span> : null;
            })}
          </span>
          <span>{total}</span>
        </div>
      ) : <span />}
      {commentCount > 0 && (
        <button onClick={onOpenComments} className="hover:underline">
          {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
        </button>
      )}
    </div>
  );
}

// ── Reaction bar ──
function ReactionBar({ postId, universityId, myReaction, onReactionChange }: {
  postId: string;
  universityId: string;
  myReaction: string | null;
  onReactionChange: (newReaction: string | null) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeReaction = REACTION_TYPES.find(r => r.key === myReaction);

  const toggleReaction = async (type: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: t('pageOS.reactions.loginRequired', 'Please sign in to react'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    setPopoverOpen(false);
    try {
      const result = await invokePageManage({
        action: 'reactions.toggle',
        university_id: universityId,
        post_id: postId,
        reaction_type: type,
      });
      if (result?.ok) {
        onReactionChange(result.my_reaction);
      }
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          className={`fb-post-card__engage-btn ${myReaction ? 'font-semibold' : ''} ${activeReaction?.color || ''}`}
          disabled={loading}
          onClick={(e) => {
            if (!popoverOpen) {
              e.preventDefault();
              toggleReaction(myReaction || 'like');
            }
          }}
          onMouseEnter={() => setPopoverOpen(true)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : activeReaction ? (
            <>
              <span className="text-base">{activeReaction.emoji}</span>
              {t(`pageOS.reactions.${activeReaction.key}`, activeReaction.label)}
            </>
          ) : (
            <>
              <ThumbsUp className="h-4 w-4" />
              {t('pageOS.reactions.like', 'Like')}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-1.5 flex gap-0.5 rounded-full bg-background/95 backdrop-blur-sm shadow-lg border border-border/50"
        side="top"
        align="start"
        onMouseLeave={() => setPopoverOpen(false)}
      >
        {REACTION_TYPES.map(r => (
          <button
            key={r.key}
            onClick={() => toggleReaction(r.key)}
            className={`text-[28px] leading-none p-1 rounded-full transition-all duration-200 hover:scale-[1.4] hover:-translate-y-1 hover:bg-muted/60 ${myReaction === r.key ? 'scale-[1.2] bg-muted ring-2 ring-primary/30' : ''}`}
            title={r.label}
          >
            <span className={myReaction === r.key ? r.animClass : ''}>{r.emoji}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── Comment section ──
function PostCommentSection({ postId, universityId, universityName, logoUrl }: {
  postId: string;
  universityId: string;
  universityName?: string;
  logoUrl?: string | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const result = await invokePageManage({
        action: 'comments.list', university_id: universityId, post_id: postId,
      });
      if (result?.ok) setComments(result.comments || []);
    } catch {}
    finally { setLoading(false); }
  }, [postId, universityId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: t('pageOS.comments.loginRequired', 'Please sign in to comment'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await invokePageManage({
        action: 'comments.create', university_id: universityId,
        post_id: postId, comment_body: newComment.trim(),
      });
      if (!result?.ok) throw new Error(result?.error || 'Failed');
      setNewComment('');
      fetchComments();
    } catch (e: any) {
      toast({ title: e.message || 'Failed', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fb-post-card__comments">
      {loading ? (
        <div className="py-2 text-center text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin inline-block" />
        </div>
      ) : (
        <>
          {comments.map(c => {
            const isOfficial = c.reply_as_university;
            const name = isOfficial
              ? universityName || t('pageOS.posts.university')
              : getProfileName(c.profile) || t('pageOS.posts.unknownAuthor');
            const initial = getInitial(name);
            const avatarUrl = isOfficial ? logoUrl : c.profile?.avatar_storage_path || null;
            const timeAgo = relativeTime(c.created_at);

            return (
              <div key={c.id} className={`flex gap-2 py-1.5 ${isOfficial ? 'ps-1' : ''}`}>
                <Avatar className="h-8 w-8 shrink-0">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
                  <AvatarFallback className={`text-[10px] ${isOfficial ? 'bg-primary/10 text-primary font-semibold' : 'bg-muted'}`}>
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className={`rounded-2xl px-3 py-2 text-sm max-w-[90%] inline-block ${isOfficial ? 'bg-primary/5 border border-primary/10' : 'bg-muted'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold text-xs ${isOfficial ? 'text-primary' : ''}`}>{name}</span>
                      {isOfficial && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                          {t('pageOS.comments.official', 'Official')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 ms-3">{timeAgo}</div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Comment input */}
      <div className="flex gap-2 items-end pt-2 border-t border-border mt-1">
        <Textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder={t('pageOS.comments.placeholder', 'Write a comment...')}
          className="min-h-[36px] text-sm resize-none flex-1 rounded-full px-4"
          rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
        />
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 rounded-full" onClick={handleSubmitComment} disabled={!newComment.trim() || submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ── Edit Post Dialog ──
function EditPostDialog({ post, universityId, open, onOpenChange, onSaved }: {
  post: PublicPost;
  universityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState(post.title || '');
  const [body, setBody] = useState(post.body || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(post.title || '');
      setBody(post.body || '');
    }
  }, [open, post]);

  const handleSave = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const result = await invokePageManage({
        action: 'posts.update',
        university_id: universityId,
        post_id: post.id,
        title: title.trim() || null,
        post_body: body.trim(),
      });
      if (result?.ok) {
        toast({ title: t('pageOS.posts.updated', 'Post updated') });
        onOpenChange(false);
        onSaved();
      } else {
        throw new Error(result?.error || 'Failed');
      }
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pageOS.posts.editPost', 'Edit Post')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('pageOS.posts.titlePlaceholder', 'Post title (optional)')}
          />
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={t('pageOS.posts.bodyPlaceholder', 'Post content...')}
            className="min-h-[120px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!body.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
            {t('common.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Staff Action Menu ──
function StaffPostActions({ post, universityId, onRefresh }: {
  post: PublicPost;
  universityId: string;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const updatePost = async (updates: Record<string, unknown>) => {
    try {
      const result = await invokePageManage({
        action: 'posts.update',
        university_id: universityId,
        post_id: post.id,
        ...updates,
      });
      if (result?.ok) {
        onRefresh();
      } else {
        throw new Error(result?.error || 'Failed');
      }
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  const deletePost = async () => {
    try {
      const result = await invokePageManage({
        action: 'posts.delete',
        university_id: universityId,
        post_id: post.id,
      });
      if (result?.ok) {
        toast({ title: t('pageOS.posts.deleted', 'Post deleted') });
        onRefresh();
      } else {
        throw new Error(result?.error || 'Failed');
      }
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Edit3 className="h-4 w-4 me-2" />
            {t('pageOS.posts.editPost', 'Edit Post')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updatePost({ pinned: !post.pinned })}>
            <Pin className="h-4 w-4 me-2" />
            {post.pinned ? t('pageOS.posts.unpin', 'Unpin') : t('pageOS.posts.pin', 'Pin')}
          </DropdownMenuItem>
          {post.status === 'draft' && (
            <DropdownMenuItem onClick={() => updatePost({ status: 'published' })}>
              <Eye className="h-4 w-4 me-2" />
              {t('pageOS.posts.publish', 'Publish')}
            </DropdownMenuItem>
          )}
          {post.status === 'published' && (
            <DropdownMenuItem onClick={() => updatePost({ status: 'archived' })}>
              <Archive className="h-4 w-4 me-2" />
              {t('pageOS.posts.archive', 'Archive')}
            </DropdownMenuItem>
          )}
          {post.status === 'archived' && (
            <DropdownMenuItem onClick={() => updatePost({ status: 'published' })}>
              <Eye className="h-4 w-4 me-2" />
              {t('pageOS.posts.publish', 'Publish')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={deletePost} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 me-2" />
            {t('pageOS.posts.deletePost', 'Delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPostDialog
        post={post}
        universityId={universityId}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onRefresh}
      />
    </>
  );
}

// ── Main Feed ──
export function PublicPostFeed({ universityId, canRefresh, universityName, logoUrl }: PublicPostFeedProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  const initials = universityName
    ? universityName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invokePageManage({ action: 'posts.list', university_id: universityId });
      if (result?.ok) {
        setPosts(result.posts || []);
        setIsStaff(!!result.is_staff);
      }
    } finally { setLoading(false); }
  }, [universityId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    if (!canRefresh) return;
    const handler = () => fetchPosts();
    window.addEventListener('posts-refresh', handler);
    return () => window.removeEventListener('posts-refresh', handler);
  }, [canRefresh, fetchPosts]);

  const toggleComments = (postId: string) => {
    setOpenComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
  };

  const handleReactionChange = (postId: string, newReaction: string | null) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const counts = { ...(p.reaction_counts || {}) };
      if (p.my_reaction && counts[p.my_reaction]) {
        counts[p.my_reaction] = Math.max(0, counts[p.my_reaction] - 1);
        if (counts[p.my_reaction] === 0) delete counts[p.my_reaction];
      }
      if (newReaction) {
        counts[newReaction] = (counts[newReaction] || 0) + 1;
      }
      return { ...p, my_reaction: newReaction, reaction_counts: counts };
    }));
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-pulse space-y-4">
          {[1, 2].map(i => <div key={i} className="h-32 bg-muted rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <div className="fb-post-feed">
      {posts.map(post => {
        const authorName = post.author ? getProfileName(post.author) : '';
        const timeAgo = (post.published_at || post.created_at) ? relativeTime(post.published_at || post.created_at) : '';

        return (
          <article key={post.id} className="fb-post-card">
            {/* Header */}
            <div className="fb-post-card__header">
              <Avatar className="h-10 w-10 border border-border shrink-0">
                <AvatarImage src={logoUrl || undefined} alt={universityName || ''} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="fb-post-card__header-text flex-1">
                <div className="fb-post-card__page-name">{universityName || t('pageOS.posts.unknownAuthor')}</div>
                <div className="fb-post-card__meta">
                  {authorName && (
                    <span className="fb-post-card__publisher">
                      {t('pageOS.posts.publishedBy', 'Published by {{name}}', { name: authorName })}
                      {' · '}
                    </span>
                  )}
                  <span>{timeAgo}</span>
                  <Globe className="h-3 w-3 ms-1" />
                </div>
              </div>

              {/* Staff management controls */}
              {isStaff && (
                <StaffPostActions post={post} universityId={universityId} onRefresh={fetchPosts} />
              )}
            </div>

            {/* Staff-only status badges */}
            <div className="fb-post-card__badges">
              {post.pinned && (
                <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                  <Pin className="w-2.5 h-2.5" />{t('pageOS.posts.pinned')}
                </Badge>
              )}
              <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[post.post_type] || ''}`}>
                {t(`pageOS.posts.type.${post.post_type}`)}
              </Badge>
              {isStaff && post.status && post.status !== 'published' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  {post.status === 'draft' && <EyeOff className="w-2.5 h-2.5" />}
                  {post.status === 'pending_review' && <Clock className="w-2.5 h-2.5" />}
                  {post.status === 'archived' && <Archive className="w-2.5 h-2.5" />}
                  {t(`pageOS.posts.status.${post.status}`, post.status)}
                </Badge>
              )}
            </div>

            {/* Content */}
            {post.title && <h3 className="fb-post-card__title">{post.title}</h3>}
            <p className="fb-post-card__body">{post.body}</p>

            {/* Media */}
            {post.attachments && post.attachments.length > 0 && (
              <div className="fb-post-card__media-grid">
                {post.attachments.map((att, i) => (
                  att.type === 'video' ? (
                    <video key={i} src={att.url} controls className="rounded-lg max-h-80 w-full object-cover" />
                  ) : (
                    <img key={i} src={att.url} alt={att.name || ''} className="rounded-lg max-h-80 w-full object-cover" loading="lazy" />
                  )
                ))}
              </div>
            )}

            {/* Reaction summary */}
            <ReactionSummary
              counts={post.reaction_counts}
              commentCount={post.comment_count}
              onOpenComments={() => toggleComments(post.id)}
            />

            {/* Action bar */}
            <div className="fb-post-card__engagement">
              <ReactionBar
                postId={post.id}
                universityId={universityId}
                myReaction={post.my_reaction}
                onReactionChange={(r) => handleReactionChange(post.id, r)}
              />
              <button className="fb-post-card__engage-btn" onClick={() => toggleComments(post.id)}>
                <MessageCircle className="h-4 w-4" />
                {t('pageOS.posts.comment', 'Comment')}
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="fb-post-card__engage-btn">
                    <Share2 className="h-4 w-4" />
                    {t('pageOS.posts.share', 'Share')}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start" side="top" sideOffset={8}>
                  <SharePopoverContent
                    postTitle={post.title}
                    postBody={post.body}
                    universityName={universityName}
                    onClose={() => {}}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Comments */}
            {openComments.has(post.id) && (
              <PostCommentSection
                postId={post.id}
                universityId={universityId}
                universityName={universityName}
                logoUrl={logoUrl}
              />
            )}
          </article>
        );
      })}

    </div>
  );
}
