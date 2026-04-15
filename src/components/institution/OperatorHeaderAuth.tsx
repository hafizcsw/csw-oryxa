/**
 * OperatorHeaderAuth — Facebook-style dropdown for page operators.
 * Shows page identity, switch-to-personal, settings, help, logout.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  Home,
  Shield,
} from 'lucide-react';

interface Props {
  universityName?: string;
  logoUrl?: string;
}

export function OperatorHeaderAuth({ universityName, logoUrl }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const initials = universityName
    ? universityName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-full p-0.5 hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={logoUrl || undefined} alt={universityName || ''} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          {/* Page identity */}
          <DropdownMenuLabel className="flex items-center gap-3 py-3">
            <Avatar className="h-10 w-10 border border-border shrink-0">
              <AvatarImage src={logoUrl || undefined} alt={universityName || ''} />
              <AvatarFallback className="text-sm bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm truncate">
                {universityName || t('institution_menu.page', 'Page')}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {t('institution_menu.managing', 'Managing')}
              </span>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Switch to personal */}
          <DropdownMenuItem onClick={() => navigate('/')} className="gap-2 cursor-pointer">
            <Home className="h-4 w-4" />
            {t('institution_menu.switch_personal', 'Switch to personal account')}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => navigate('/account')} className="gap-2 cursor-pointer">
            <User className="h-4 w-4" />
            {t('institution_menu.my_profile', 'My profile')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Page settings */}
          <DropdownMenuItem onClick={() => {
            // Dispatch custom event to open settings tab in sidebar
            window.dispatchEvent(new CustomEvent('operator-tab', { detail: 'settings' }));
          }} className="gap-2 cursor-pointer">
            <Settings className="h-4 w-4" />
            {t('institution_menu.page_settings', 'Page settings')}
          </DropdownMenuItem>

          {/* Help */}
          <DropdownMenuItem onClick={() => navigate('/contact')} className="gap-2 cursor-pointer">
            <HelpCircle className="h-4 w-4" />
            {t('institution_menu.help_support', 'Help & support')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Logout */}
          <DropdownMenuItem
            onClick={() => setShowLogoutDialog(true)}
            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {t('institution_menu.logout', 'Log out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Logout confirmation */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('institution_menu.logout_title', 'Log out?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('institution_menu.logout_desc', 'You will be signed out of your management session.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              {t('institution_menu.logout', 'Log out')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
