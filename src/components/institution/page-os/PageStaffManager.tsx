/**
 * Page staff management panel — operator overlay.
 * Lists staff + invitations, allows inviting/removing/changing roles.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Trash2, Shield, X, Mail, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePageStaffRole } from '@/hooks/usePageStaffRole';

const ROLES = [
  'full_control', 'page_admin', 'content_publisher',
  'moderator', 'inbox_agent', 'analyst', 'live_community_manager',
] as const;

interface PageStaffManagerProps {
  universityId: string;
}

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  profile?: { first_name?: string; last_name?: string; email?: string };
}

interface Invitation {
  id: string;
  email: string;
  intended_role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export function PageStaffManager({ universityId }: PageStaffManagerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isSuperAdmin } = usePageStaffRole(universityId);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<string>('content_publisher');
  const [adding, setAdding] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, invRes] = await Promise.all([
        supabase.functions.invoke('university-page-manage', { body: { action: 'staff.list', university_id: universityId } }),
        supabase.functions.invoke('university-page-manage', { body: { action: 'staff.list_invites', university_id: universityId } }),
      ]);
      if (staffRes.data?.ok) setStaff(staffRes.data.staff || []);
      if (invRes.data?.ok) setInvitations(invRes.data.invitations || []);
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  useEffect(() => {
    if (!isSuperAdmin && newRole === 'full_control') {
      setNewRole('content_publisher');
    }
  }, [isSuperAdmin, newRole]);

  const assignableRoles = isSuperAdmin ? [...ROLES] : ROLES.filter(role => role !== 'full_control');

  const getRoleOptions = (currentRole?: string) => {
    if (!currentRole) return assignableRoles;
    if (isSuperAdmin) return [...ROLES];
    if (currentRole === 'full_control') return ['full_control'] as const;
    return assignableRoles;
  };

  const inviteStaff = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'staff.invite', university_id: universityId, user_email: newEmail.trim(), role: newRole } });
      if (data?.ok) {
        toast({ title: t('pageOS.staff.invited') });
        setNewEmail('');
        setAddOpen(false);
        fetchStaff();
      } else {
        toast({ title: data?.error || 'Error', variant: 'destructive' });
      }
    } finally {
      setAdding(false);
    }
  };

  const removeStaff = async (staffId: string) => {
    await supabase.functions.invoke('university-page-manage', { body: { action: 'staff.remove', university_id: universityId, staff_id: staffId } });
    fetchStaff();
  };

  const changeRole = async (staffId: string, newR: string) => {
    await supabase.functions.invoke('university-page-manage', { body: { action: 'staff.update_role', university_id: universityId, staff_id: staffId, new_role: newR } });
    fetchStaff();
  };

  const revokeInvite = async (inviteId: string) => {
    await supabase.functions.invoke('university-page-manage', { body: { action: 'staff.revoke_invite', university_id: universityId, invite_id: inviteId } });
    fetchStaff();
  };

  const resendInvite = async (inviteId: string) => {
    const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'staff.resend_invite', university_id: universityId, invite_id: inviteId } });
    if (data?.ok) toast({ title: t('pageOS.staff.inviteResent') });
    fetchStaff();
  };

  const roleColor: Record<string, string> = {
    full_control: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    page_admin: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    content_publisher: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    moderator: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    inbox_agent: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    analyst: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    live_community_manager: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  };

  const pendingInvites = invitations.filter(i => i.status === 'pending');

  return (
    <div className="fb-staff-manager">
      <div className="fb-staff-manager__header">
        <h3 className="fb-staff-manager__title">
          <Shield className="w-4 h-4" /> {t('pageOS.staff.title')}
        </h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Mail className="w-3 h-3" /> {t('pageOS.staff.invite')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('pageOS.staff.inviteTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input
                type="email"
                placeholder={t('pageOS.staff.emailPlaceholder')}
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map(r => (
                    <SelectItem key={r} value={r}>{t(`pageOS.staff.role.${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={inviteStaff} disabled={adding || !newEmail.trim()}>
                {t('pageOS.staff.sendInvite')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">{t('pageOS.common.loading')}</div>
      ) : (
        <>
          {/* Active Staff */}
          <div className="fb-staff-manager__list">
            {staff.map(s => (
              <div key={s.id} className="fb-staff-manager__item">
                <div className="fb-staff-manager__info">
                  <span className="fb-staff-manager__name">
                    {s.profile ? `${s.profile.first_name || ''} ${s.profile.last_name || ''}`.trim() || s.profile.email : s.user_id.slice(0, 8)}
                  </span>
                  <Badge className={`text-xs ${roleColor[s.role] || ''}`}>
                    {t(`pageOS.staff.role.${s.role}`)}
                  </Badge>
                </div>
                <div className="fb-staff-manager__actions">
                  <Select
                    value={s.role}
                    onValueChange={v => changeRole(s.id, v)}
                    disabled={!isSuperAdmin && s.role === 'full_control'}
                  >
                    <SelectTrigger className="h-7 text-xs w-auto min-w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getRoleOptions(s.role).map(r => (
                        <SelectItem key={r} value={r}>{t(`pageOS.staff.role.${r}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => removeStaff(s.id)}
                    disabled={!isSuperAdmin && s.role === 'full_control'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {t('pageOS.staff.pendingInvites')}
              </h4>
              <div className="space-y-2">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{inv.email}</span>
                      <span className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{t(`pageOS.staff.role.${inv.intended_role}`)}</Badge>
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => resendInvite(inv.id)}
                        title={t('pageOS.staff.resend')}
                        disabled={!isSuperAdmin && inv.intended_role === 'full_control'}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => revokeInvite(inv.id)}
                        title={t('pageOS.staff.revoke')}
                        disabled={!isSuperAdmin && inv.intended_role === 'full_control'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
