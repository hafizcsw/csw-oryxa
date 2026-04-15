/**
 * TeacherVideoUpload — Allows teachers to set their intro video via external URL (YouTube, etc).
 */
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Video, Link2, Trash2, CheckCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

function getEmbedUrl(url: string): string | null {
  try {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    // Direct video link
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return url;
    return url;
  } catch {
    return null;
  }
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export function TeacherVideoUpload() {
  const { t } = useLanguage();
  const [videoUrl, setVideoUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (loaded) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('teacher_intro_videos')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setSavedUrl(data.video_url || data.video_path || null);
        setVideoUrl(data.video_url || data.video_path || '');
        setRecordId(data.id);
      }
      setLoaded(true);
    })();
  }, [loaded]);

  const handleSave = async () => {
    const trimmed = videoUrl.trim();
    if (!trimmed) {
      toast.error(t('staff.teacher.video.enterUrl', { defaultValue: 'Please enter a video URL' }));
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: record, error } = await supabase
        .from('teacher_intro_videos')
        .upsert({
          user_id: user.id,
          video_path: trimmed,
          title: 'Intro Video',
          status: 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      setSavedUrl(trimmed);
      setRecordId(record.id);
      toast.success(t('staff.teacher.video.saved', { defaultValue: 'Video link saved!' }));
    } catch (err: any) {
      console.error('Video save error:', err);
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recordId) return;
    setDeleting(true);
    try {
      await supabase.from('teacher_intro_videos').delete().eq('id', recordId);
      setSavedUrl(null);
      setVideoUrl('');
      setRecordId(null);
      toast.success(t('staff.teacher.video.deleted', { defaultValue: 'Video removed' }));
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const embedUrl = savedUrl ? getEmbedUrl(savedUrl) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-5 w-5 text-primary" />
          {t('staff.teacher.video.title', { defaultValue: 'Intro Video' })}
          {savedUrl && (
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <CheckCircle className="w-3 h-3 me-1" />
              {t('staff.teacher.video.active', { defaultValue: 'Active' })}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {t('staff.teacher.video.urlDescription', { defaultValue: 'Add a YouTube or video link for your intro video. This will appear on your public profile.' })}
        </p>

        {/* Preview */}
        {savedUrl && embedUrl && (
          <div className="mb-4">
            <div className="rounded-xl overflow-hidden bg-black aspect-video">
              {isDirectVideo(embedUrl) ? (
                <video src={embedUrl} controls className="w-full h-full" />
              ) : (
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Intro Video"
                />
              )}
            </div>
            <div className="flex items-center justify-between mt-2">
              <a
                href={savedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 truncate max-w-[250px]"
              >
                <ExternalLink className="w-3 h-3" />
                {savedUrl}
              </a>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5 me-1.5" />
                {t('staff.teacher.video.delete', { defaultValue: 'Delete' })}
              </Button>
            </div>
          </div>
        )}

        {/* URL Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('staff.teacher.video.urlPlaceholder', { defaultValue: 'https://youtube.com/watch?v=...' })}
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="ps-9"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !videoUrl.trim()}>
            {t('staff.teacher.video.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
