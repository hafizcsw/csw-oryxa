import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Upload, CheckCircle, XCircle, MoreVertical } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface UniversityBulkActionsProps {
  selectedIds: string[];
  isQuarantineFilter?: boolean;
  onActionComplete: () => void;
}

export default function UniversityBulkActions({
  selectedIds,
  isQuarantineFilter = false,
  onActionComplete,
}: UniversityBulkActionsProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const handleActivate = async () => {
    try {
      const { error } = await supabase
        .from("universities")
        .update({ is_active: true })
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: t('admin.universities.bulk.activateSuccess'),
        description: t('admin.universities.bulk.activateSuccessDesc').replace('{{count}}', String(selectedIds.length)),
      });

      onActionComplete();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('admin.toast.error'),
        description: error.message,
      });
    } finally {
      setShowActivateDialog(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      const { error } = await supabase
        .from("universities")
        .update({ is_active: false })
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: t('admin.universities.bulk.deactivateSuccess'),
        description: t('admin.universities.bulk.deactivateSuccessDesc').replace('{{count}}', String(selectedIds.length)),
      });

      onActionComplete();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('admin.toast.error'),
        description: error.message,
      });
    } finally {
      setShowDeactivateDialog(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const { data, error } = await supabase
        .from("universities")
        .select("*, countries(name_ar, slug)")
        .in("id", selectedIds);

      if (error) throw error;

      // Convert to CSV
      const headers = [
        "ID",
        "Name",
        "Country",
        "City",
        "Website",
        "Logo URL",
        "Annual Fees",
        "Monthly Living",
        "Ranking",
        "Is Active",
      ];
      
      const rows = data.map((uni: any) => [
        uni.id,
        uni.name,
        uni.countries?.name_ar || "",
        uni.city || "",
        uni.website || "",
        uni.logo_url || "",
        uni.annual_fees || "",
        uni.monthly_living || "",
        uni.ranking || "",
        uni.is_active ? t('admin.universities.bulk.yes') : t('admin.universities.bulk.no'),
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      // Download
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `universities_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();

      toast({
        title: t('admin.universities.bulk.exportSuccess'),
        description: t('admin.universities.bulk.exportSuccessDesc').replace('{{count}}', String(selectedIds.length)),
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('admin.toast.error'),
        description: error.message,
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={selectedIds.length === 0}>
            <MoreVertical className="w-4 h-4 ml-2" />
            {t('admin.universities.bulk.bulkActions')} ({selectedIds.length})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem 
            onClick={() => setShowActivateDialog(true)}
            disabled={isQuarantineFilter}
            className={isQuarantineFilter ? "opacity-50" : ""}
          >
            <CheckCircle className="w-4 h-4 ml-2" />
            {isQuarantineFilter ? t('admin.universities.bulk.cannotActivateNoCountry') : t('admin.universities.bulk.activate')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowDeactivateDialog(true)}>
            <XCircle className="w-4 h-4 ml-2" />
            {t('admin.universities.bulk.deactivate')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportCSV}>
            <Download className="w-4 h-4 ml-2" />
            {t('admin.universities.bulk.exportCsv')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.universities.bulk.activateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.universities.bulk.activateDesc').replace('{{count}}', String(selectedIds.length))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.universities.bulk.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate}>{t('admin.universities.bulk.activate_btn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.universities.bulk.deactivateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.universities.bulk.deactivateDesc').replace('{{count}}', String(selectedIds.length))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.universities.bulk.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>{t('admin.universities.bulk.deactivate_btn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
