/**
 * Post composer for university page operators — Facebook-style.
 * Supports text, emoji, image/video uploads.
 */
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Pin, ImageIcon, Video, X, Loader2, Smile, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const POST_TYPES = [
  'news', 'announcement', 'scholarship', 'seats_available',
  'application_deadline', 'event', 'official_update',
] as const;

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_IMAGE = 'image/jpeg,image/png,image/gif,image/webp';
const ACCEPTED_VIDEO = 'video/mp4,video/webm,video/quicktime';

// Modern emoji categories
const EMOJI_CATEGORIES = [
  { label: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😋','😛','🤔','🤗','🫡','🤫','🫢','😶','😏','😌','😴','🥱','😷','🤒','🤕','🤧','🥵','🥶','😵','🤯','🥳','🥸','😎','🤓','🧐'] },
  { label: '👍', emojis: ['👍','👎','👏','🙌','🤝','💪','✌️','🤞','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💯','🔥','⭐','✨','💫','🎉','🎊','🏆','🥇','🥈','🥉','🎓','📚'] },
  { label: '🌍', emojis: ['🌍','🌎','🌏','🏫','🏛️','🏢','✈️','🚀','🌟','📝','📖','🎯','💡','📊','📈','🔔','📌','📎','✅','❌','⚠️','💬','💭','🗣️','👥','🤝','🎓','📜','🏅','🎖️'] },
];

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface PagePostComposerProps {
  universityId: string;
  logoUrl?: string | null;
  universityName?: string;
  onPostCreated?: () => void;
}

async function invokePageManage(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; post?: any }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  const res = await fetch(`${baseUrl}/functions/v1/university-page-manage`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(json?.error || json?.message || text || res.statusText || 'Unknown error');
  return json;
}

export function PagePostComposer({ universityId, logoUrl, universityName, onPostCreated }: PagePostComposerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [postType, setPostType] = useState<string>('news');
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const initials = universityName
    ? universityName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video') => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: MediaFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: t('pageOS.posts.fileTooLarge', 'File too large (max 50MB)'), variant: 'destructive' });
        continue;
      }
      newFiles.push({ file, preview: URL.createObjectURL(file), type: mediaType });
    }
    setMediaFiles(prev => [...prev, ...newFiles]);
    setExpanded(true);
    e.target.value = '';
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const insertEmoji = useCallback((emoji: string) => {
    setBody(prev => prev + emoji);
    textareaRef.current?.focus();
  }, []);

  const uploadMedia = async (): Promise<Array<{ url: string; type: string; name: string }>> => {
    const attachments: Array<{ url: string; type: string; name: string }> = [];
    for (const media of mediaFiles) {
      const ext = media.file.name.split('.').pop() || 'bin';
      const path = `${universityId}/posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('university-media')
        .upload(path, media.file, { contentType: media.file.type, upsert: false });
      if (error) throw new Error(error.message);
      const { data: urlData } = supabase.storage.from('university-media').getPublicUrl(path);
      attachments.push({ url: urlData.publicUrl, type: media.type, name: media.file.name });
    }
    return attachments;
  };

  const handleSubmit = async () => {
    if (!body.trim() && mediaFiles.length === 0) return;
    setSubmitting(true);
    try {
      const postBody = body.trim() || (mediaFiles.length > 0 ? '📸' : '');
      const result = await invokePageManage({
        action: 'posts.create', university_id: universityId,
        post_type: postType, title: title.trim() || null,
        post_body: postBody, pinned, attachments: [],
      });
      if (!result?.ok) throw new Error(result?.error || 'Unknown server error');
      const postId = result.post?.id;

      if (mediaFiles.length > 0 && postId) {
        try {
          const attachments = await uploadMedia();
          await invokePageManage({ action: 'posts.update', university_id: universityId, post_id: postId, attachments });
        } catch (uploadErr: any) {
          toast({ title: t('pageOS.posts.uploadFailed', 'Post created but media upload failed: ') + uploadErr.message, variant: 'destructive' });
        }
      }

      toast({ title: t('pageOS.posts.created') });
      setBody(''); setTitle(''); setPinned(false); setExpanded(false);
      mediaFiles.forEach(m => URL.revokeObjectURL(m.preview));
      setMediaFiles([]);
      onPostCreated?.();
    } catch (e: any) {
      toast({ title: e.message || 'Failed', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const canSubmit = body.trim().length > 0 || mediaFiles.length > 0;

  return (
    <div className="fb-composer">
      <input ref={imageInputRef} type="file" accept={ACCEPTED_IMAGE} multiple className="hidden" onChange={e => handleFileSelect(e, 'image')} />
      <input ref={videoInputRef} type="file" accept={ACCEPTED_VIDEO} className="hidden" onChange={e => handleFileSelect(e, 'video')} />

      <div className="fb-composer__top">
        <Avatar className="h-10 w-10 border border-border shrink-0">
          <AvatarImage src={logoUrl || undefined} alt={universityName || ''} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        {!expanded ? (
          <button className="fb-composer__pill" onClick={() => setExpanded(true)}>
            {t('pageOS.posts.composerPlaceholder')}
          </button>
        ) : (
          <div className="fb-composer__expanded">
            <input
              className="fb-composer__title-input"
              placeholder={t('pageOS.posts.titleOptional')}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
        )}
      </div>

      {expanded && (
        <>
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={t('pageOS.posts.bodyPlaceholder')}
            className="fb-composer__textarea"
            rows={4}
            autoFocus
          />

          {mediaFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pb-2">
              {mediaFiles.map((media, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden border border-border">
                  {media.type === 'image' ? (
                    <img src={media.preview} alt="" className="h-24 w-24 object-cover" />
                  ) : (
                    <video src={media.preview} className="h-24 w-24 object-cover" />
                  )}
                  <button onClick={() => removeMedia(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[10px] text-center py-0.5">
                    {media.type === 'image' ? '📷' : '🎬'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="fb-composer__options">
            <Select value={postType} onValueChange={setPostType}>
              <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map(pt => (
                  <SelectItem key={pt} value={pt}>{t(`pageOS.posts.type.${pt}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant={pinned ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-1 text-xs" onClick={() => setPinned(!pinned)}>
              <Pin className="h-3 w-3" />{t('pageOS.posts.pin')}
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => { setExpanded(false); mediaFiles.forEach(m => URL.revokeObjectURL(m.preview)); setMediaFiles([]); }}>
              {t('pageOS.common.cancel')}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || submitting} className="gap-1.5">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('pageOS.posts.publish')}
            </Button>
          </div>
        </>
      )}

      {/* Facebook-style bottom bar: Photo/Video · Reel · Emoji */}
      <div className="fb-composer__media-bar">
        <button className="fb-composer__media-btn" onClick={() => imageInputRef.current?.click()}>
          <ImageIcon className="h-5 w-5 text-green-500" />
          <span>{t('pageOS.posts.photoVideo', 'Photo/Video')}</span>
        </button>
        <button className="fb-composer__media-btn" onClick={() => videoInputRef.current?.click()}>
          <Video className="h-5 w-5 text-rose-500" />
          <span>{t('pageOS.posts.reel', 'Reel')}</span>
        </button>
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <button className="fb-composer__media-btn">
              <Smile className="h-5 w-5 text-amber-500" />
              <span>{t('pageOS.posts.emoji', 'Emoji')}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            {/* Emoji tab headers */}
            <div className="flex gap-1 border-b border-border pb-1 mb-2">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={i}
                  onClick={() => setEmojiTab(i)}
                  className={`px-2 py-1 rounded text-lg transition-colors ${emojiTab === i ? 'bg-primary/10' : 'hover:bg-muted'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Emoji grid */}
            <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
              {EMOJI_CATEGORIES[emojiTab].emojis.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => { insertEmoji(emoji); setEmojiOpen(false); }}
                  className="text-xl p-1 rounded hover:bg-muted transition-colors text-center"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
