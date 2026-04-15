/**
 * Unified University Settings Panel — Facebook-inspired design
 * Professional grouped settings with clean toggles and visual hierarchy.
 *
 * All keys persisted in university_page_settings table.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings, Save, Loader2, MessageCircle, Eye, Users2, FileText,
  ShieldCheck, ExternalLink, ChevronRight, Check, AlertCircle,
  Globe, Bell, Lock, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PageSettingsPanelProps {
  universityId: string;
}

/* ── Category definitions ── */
type CategoryKey = 'messaging' | 'display' | 'community' | 'publishing' | 'access';

const CATEGORIES: { key: CategoryKey; icon: typeof Settings }[] = [
  { key: 'messaging', icon: MessageCircle },
  { key: 'display', icon: Globe },
  { key: 'community', icon: Users2 },
  { key: 'publishing', icon: FileText },
  { key: 'access', icon: Lock },
];

/* ── No custom toggle — using shadcn Switch ── */

/* ── Setting item with status indicator ── */
function SettingItem({
  label,
  description,
  badge,
  children,
  className,
}: {
  label: string;
  description: string;
  badge?: 'public' | 'operator' | 'community';
  children: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const badgeConfig = {
    public: { label: t('pageOS.settings.badge.public', 'Public'), className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    operator: { label: t('pageOS.settings.badge.operator', 'Operator'), className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    community: { label: t('pageOS.settings.badge.community', 'Community'), className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  };

  return (
    <div className={cn(
      'group flex items-center justify-between gap-4 px-4 py-3.5 rounded-lg transition-colors hover:bg-muted/50',
      className
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {badge && (
            <span className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none',
              badgeConfig[badge].className
            )}>
              {badgeConfig[badge].label}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ── Section divider ── */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="px-4 pt-4 pb-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</span>
    </div>
  );
}

/* ── SETTINGS KEYS with defaults ── */
const SETTINGS_DEFAULTS: Record<string, unknown> = {
  messaging_enabled: true,
  auto_reply_message: '',
  posts_visible: true,
  programs_visible: true,
  scholarships_visible: true,
  contact_visible: true,
  comments_enabled: true,
  reactions_enabled: true,
  moderation_required: false,
  auto_publish: true,
};

export function PageSettingsPanel({ universityId }: PageSettingsPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown>>({ ...SETTINGS_DEFAULTS });
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('messaging');
  const sectionRefs = useRef<Record<CategoryKey, HTMLDivElement | null>>({
    messaging: null,
    display: null,
    community: null,
    publishing: null,
    access: null,
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'settings.get', university_id: universityId } });
      if (data?.ok) {
        setSettings(prev => ({ ...prev, ...(data.settings || {}) }));
      }
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSetting = async (key: string, value: unknown) => {
    setSaving(key);
    setSettings(prev => ({ ...prev, [key]: value }));
    try {
      const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'settings.set', university_id: universityId, key, value } });
      if (data?.ok) {
        toast({ title: t('pageOS.settings.saved', 'Setting saved'), description: t('pageOS.settings.savedDesc', 'Changes applied successfully.') });
      } else {
        toast({ title: t('pageOS.settings.saveFailed', 'Save failed'), variant: 'destructive' });
        fetchSettings();
      }
    } finally {
      setSaving(null);
    }
  };

  const getBool = (key: string) => settings[key] !== false;
  const getString = (key: string) => (typeof settings[key] === 'string' ? settings[key] as string : '');

  const scrollToSection = (key: CategoryKey) => {
    setActiveCategory(key);
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const categoryLabels: Record<CategoryKey, string> = {
    messaging: t('pageOS.settings.messaging', 'Messaging'),
    display: t('pageOS.settings.publicDisplay', 'Page Visibility'),
    community: t('pageOS.settings.community', 'Community'),
    publishing: t('pageOS.settings.publishing', 'Publishing'),
    access: t('pageOS.settings.accessRoles', 'Access & Roles'),
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('pageOS.settings.loading', 'Loading settings...')}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-0 max-w-4xl">
      {/* ─── Left sidebar navigation ─── */}
      <div className="w-52 shrink-0 border-e border-border/50 pe-0 hidden md:block">
        <div className="sticky top-0 pt-1">
          <h3 className="text-base font-bold text-foreground px-3 mb-4 flex items-center gap-2">
            <Settings className="w-4.5 h-4.5 text-primary" />
            {t('pageOS.settings.title', 'Settings')}
          </h3>
          <nav className="space-y-0.5">
            {CATEGORIES.map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => scrollToSection(key)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                  activeCategory === key
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{categoryLabels[key]}</span>
                {activeCategory === key && (
                  <ChevronRight className="w-3.5 h-3.5 ms-auto shrink-0" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ─── Main content area ─── */}
      <div className="flex-1 min-w-0 ps-0 md:ps-6 space-y-1">

        {/* ══ Mobile category tabs ══ */}
        <div className="flex gap-1 overflow-x-auto pb-2 md:hidden">
          {CATEGORIES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => scrollToSection(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                activeCategory === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {categoryLabels[key]}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            1. MESSAGING
        ══════════════════════════════════════════════ */}
        <div ref={el => { sectionRefs.current.messaging = el; }}>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <MessageCircle className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{categoryLabels.messaging}</h4>
                  <p className="text-[11px] text-muted-foreground">{t('pageOS.settings.messagingSubtitle', 'Control how students communicate with your page')}</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/30">
              <SettingItem
                label={t('pageOS.settings.messagingEnabledLabel', 'Inbox & Inquiries')}
                description={t('pageOS.settings.messagingEnabledDesc', 'Allow students to send inquiries through the page')}
                badge="public"
              >
                <Switch
                  checked={getBool('messaging_enabled')}
                  onCheckedChange={(v) => saveSetting('messaging_enabled', v)}
                  disabled={saving === 'messaging_enabled'}
                />
              </SettingItem>

              <div className="px-4 py-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {t('pageOS.settings.autoReplyLabel', 'Auto-reply message')}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {t('pageOS.settings.badge.operator', 'Operator')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2.5">
                  {t('pageOS.settings.autoReplyDesc', 'Automatic response sent when a student sends a message')}
                </p>
                <Textarea
                  value={getString('auto_reply_message')}
                  onChange={e => setSettings(prev => ({ ...prev, auto_reply_message: e.target.value }))}
                  placeholder={t('pageOS.settings.autoReplyPlaceholder', 'e.g. Thank you for your message. We will respond soon.')}
                  className="text-sm min-h-[80px] bg-muted/30 border-border/50 focus:bg-background transition-colors resize-none rounded-lg"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    className="gap-1.5 rounded-lg h-8 px-4 text-xs font-medium"
                    onClick={() => saveSetting('auto_reply_message', getString('auto_reply_message') || null)}
                    disabled={saving === 'auto_reply_message'}
                  >
                    {saving === 'auto_reply_message' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    {t('pageOS.settings.saveMessage', 'Save Message')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            2. PAGE VISIBILITY
        ══════════════════════════════════════════════ */}
        <div ref={el => { sectionRefs.current.display = el; }} className="pt-4">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{categoryLabels.display}</h4>
                  <p className="text-[11px] text-muted-foreground">{t('pageOS.settings.displaySubtitle', 'Choose what visitors see on your public page')}</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/30">
              <SettingItem
                label={t('pageOS.settings.postsVisible', 'Posts')}
                description={t('pageOS.settings.postsVisibleDesc', 'Show the posts feed tab on your public page')}
                badge="public"
              >
                <Switch
                  checked={getBool('posts_visible')}
                  onCheckedChange={(v) => saveSetting('posts_visible', v)}
                  disabled={saving === 'posts_visible'}
                />
              </SettingItem>

              <SettingItem
                label={t('pageOS.settings.programsVisible', 'Programs')}
                description={t('pageOS.settings.programsVisibleDesc', 'Show the academic programs listing tab')}
                badge="public"
              >
                <Switch
                  checked={getBool('programs_visible')}
                  onCheckedChange={(v) => saveSetting('programs_visible', v)}
                  disabled={saving === 'programs_visible'}
                />
              </SettingItem>

              <SettingItem
                label={t('pageOS.settings.scholarshipsVisible', 'Scholarships')}
                description={t('pageOS.settings.scholarshipsVisibleDesc', 'Show the scholarships and funding tab')}
                badge="public"
              >
                <Switch
                  checked={getBool('scholarships_visible')}
                  onCheckedChange={(v) => saveSetting('scholarships_visible', v)}
                  disabled={saving === 'scholarships_visible'}
                />
              </SettingItem>

              <SettingItem
                label={t('pageOS.settings.contactVisible', 'Contact Information')}
                description={t('pageOS.settings.contactVisibleDesc', 'Show phone, email, and social links to visitors')}
                badge="public"
              >
                <Switch
                  checked={getBool('contact_visible')}
                  onCheckedChange={(v) => saveSetting('contact_visible', v)}
                  disabled={saving === 'contact_visible'}
                />
              </SettingItem>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            3. COMMUNITY
        ══════════════════════════════════════════════ */}
        <div ref={el => { sectionRefs.current.community = el; }} className="pt-4">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <Users2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{categoryLabels.community}</h4>
                  <p className="text-[11px] text-muted-foreground">{t('pageOS.settings.communitySubtitle', 'Manage engagement and moderation policies')}</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/30">
              <SettingItem
                label={t('pageOS.settings.commentsEnabled', 'Comments')}
                description={t('pageOS.settings.commentsEnabledDesc', 'Allow users to comment on posts')}
                badge="community"
              >
                <Switch
                  checked={getBool('comments_enabled')}
                  onCheckedChange={(v) => saveSetting('comments_enabled', v)}
                  disabled={saving === 'comments_enabled'}
                />
              </SettingItem>

              <SettingItem
                label={t('pageOS.settings.reactionsEnabled', 'Reactions')}
                description={t('pageOS.settings.reactionsEnabledDesc', 'Allow users to react to posts')}
                badge="community"
              >
                <Switch
                  checked={getBool('reactions_enabled')}
                  onCheckedChange={(v) => saveSetting('reactions_enabled', v)}
                  disabled={saving === 'reactions_enabled'}
                />
              </SettingItem>

              <SettingItem
                label={t('pageOS.settings.moderationRequired', 'Moderation')}
                description={t('pageOS.settings.moderationRequiredDesc', 'New comments require approval before becoming visible')}
                badge="community"
              >
                <Switch
                  checked={settings.moderation_required === true}
                  onCheckedChange={(v) => saveSetting('moderation_required', v)}
                  disabled={saving === 'moderation_required'}
                />
              </SettingItem>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            4. PUBLISHING
        ══════════════════════════════════════════════ */}
        <div ref={el => { sectionRefs.current.publishing = el; }} className="pt-4">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                  <FileText className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{categoryLabels.publishing}</h4>
                  <p className="text-[11px] text-muted-foreground">{t('pageOS.settings.publishingSubtitle', 'Control how content gets published')}</p>
                </div>
              </div>
            </div>

            <div>
              <SettingItem
                label={t('pageOS.settings.autoPublish', 'Auto-publish')}
                description={t('pageOS.settings.autoPublishDesc', 'Posts go live immediately. When off, posts start as drafts for review.')}
                badge="operator"
              >
                <Switch
                  checked={getBool('auto_publish')}
                  onCheckedChange={(v) => saveSetting('auto_publish', v)}
                  disabled={saving === 'auto_publish'}
                />
              </SettingItem>

              {/* Status indicator */}
              <div className="px-4 pb-3">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                  getBool('auto_publish')
                    ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/5 text-amber-600 dark:text-amber-400'
                )}>
                  {getBool('auto_publish') ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {t('pageOS.settings.autoPublishOn', 'New posts will be published immediately')}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      {t('pageOS.settings.autoPublishOff', 'New posts will start as drafts')}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            5. ACCESS & ROLES
        ══════════════════════════════════════════════ */}
        <div ref={el => { sectionRefs.current.access = el; }} className="pt-4 pb-8">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-500/10">
                  <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{categoryLabels.access}</h4>
                  <p className="text-[11px] text-muted-foreground">{t('pageOS.settings.accessSubtitle', 'Manage who can do what on this page')}</p>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-foreground font-medium">
                    {t('pageOS.settings.accessRolesTitle', 'Staff & Permissions')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('pageOS.settings.accessRolesDesc', 'Staff roles and permissions are managed in the Staff Management workspace.')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5 rounded-lg h-8 text-xs font-medium"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('page-os:navigate-tab', { detail: 'staff' }));
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t('pageOS.settings.goToStaff', 'Open Staff Management')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
