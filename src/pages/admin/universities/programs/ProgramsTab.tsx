import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  CheckCircle,
  Clock,
  RefreshCw,
  Languages,
  DollarSign,
  Star
} from "lucide-react";
import ProgramEditorModal from "./ProgramEditorModal";

interface ProgramsTabProps {
  universityId: string;
}

export default function ProgramsTab({ universityId }: ProgramsTabProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);

  // Fetch programs with related data
  const { data: programs = [], isLoading, refetch } = useQuery({
    queryKey: ["university-programs", universityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select(`
          *,
          degrees:degree_id (id, name, slug),
          disciplines:discipline_id (id, name_ar, slug),
          csw_program_guidance (csw_recommended, do_not_offer)
        `)
        .eq("university_id", universityId)
        .order("title");

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch program languages for all programs
  const { data: allProgramLanguages = [] } = useQuery({
    queryKey: ["all-program-languages", universityId],
    queryFn: async () => {
      const programIds = programs.map(p => p.id);
      if (programIds.length === 0) return [];
      
      const { data } = await supabase
        .from("program_languages")
        .select("program_id, language_code")
        .in("program_id", programIds);
      
      return data || [];
    },
    enabled: programs.length > 0,
  });

  // Group languages by program
  const languagesByProgram = allProgramLanguages.reduce((acc: Record<string, string[]>, curr) => {
    if (!acc[curr.program_id]) acc[curr.program_id] = [];
    acc[curr.program_id].push(curr.language_code);
    return acc;
  }, {});

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (programId: string) => {
      // Delete languages first
      await supabase.from("program_languages").delete().eq("program_id", programId);
      // Delete program
      const { error } = await supabase.from("programs").delete().eq("id", programId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("admin.programs.deleted") });
      queryClient.invalidateQueries({ queryKey: ["university-programs", universityId] });
    },
    onError: (error: any) => {
      toast({ 
        title: t("admin.programs.deleteError"), 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Quick publish mutation - validates SoT requirements before publishing
  const publishMutation = useMutation({
    mutationFn: async ({ programId, status, program }: { programId: string; status: string; program?: any }) => {
      // If publishing, validate SoT requirements (trigger will also enforce, but better UX to check first)
      if (status === "published" && program) {
        const hasLanguagesInJoinTable = (languagesByProgram[programId]?.length || 0) > 0;
        
        const hasFees = 
          program.tuition_is_free === true || 
          (
            !!program.currency_code &&
            (program.tuition_local_min != null || program.tuition_local_max != null) &&
            (Number(program.tuition_local_min ?? program.tuition_local_max) > 0)
          );
        
        const errors: string[] = [];
        if (!program.is_active) errors.push(t("admin.programs.validation.programInactive"));
        if (!program.duration_months) errors.push(t("admin.programs.validation.durationMissing"));
        if (!hasFees) {
          if (!program.tuition_is_free && !program.currency_code) {
            errors.push(t("admin.programs.validation.currencyMissing"));
          }
          if (!program.tuition_is_free && program.tuition_local_min == null && program.tuition_local_max == null) {
            errors.push(t("admin.programs.validation.feesMissing"));
          }
        }
        if (!hasLanguagesInJoinTable) {
          errors.push(t("admin.programs.validation.languagesMissing"));
        }
        if (!program.degree_id) errors.push(t("admin.programs.validation.degreeMissing"));
        if (!program.discipline_id) errors.push(t("admin.programs.validation.disciplineMissing"));
        
        if (errors.length > 0) {
          throw new Error(`${t("admin.programs.validation.cannotPublish")}\n• ${errors.join("\n• ")}`);
        }
      }
      
      const { error } = await supabase
        .from("programs")
        .update({ publish_status: status })
        .eq("id", programId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("admin.programs.statusUpdated") });
      queryClient.invalidateQueries({ queryKey: ["university-programs", universityId] });
      queryClient.invalidateQueries({ queryKey: ["university-program-counts"] });
    },
    onError: (error: any) => {
      toast({ 
        title: t("admin.scholarships.error"), 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleEdit = (program: any) => {
    setSelectedProgram(program);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedProgram(null);
    setModalOpen(true);
  };

  const handleDelete = (programId: string, title: string) => {
    if (confirm(t("admin.programs.confirmDelete").replace("{title}", title))) {
      deleteMutation.mutate(programId);
    }
  };

  const handleTogglePublish = (programId: string, currentStatus: string, program?: any) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    publishMutation.mutate({ programId, status: newStatus, program });
  };

  const filteredPrograms = programs.filter((p: any) =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.degrees?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.disciplines?.name_ar?.includes(searchQuery)
  );

  const publishedCount = programs.filter((p: any) => p.publish_status === "published").length;
  const draftCount = programs.filter((p: any) => p.publish_status !== "published").length;

  return (
    <Card className="p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold">{t("admin.programs.title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.programs.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            {publishedCount} {t("admin.programs.published")}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3 text-amber-500" />
            {draftCount} {t("admin.programs.draft")}
          </Badge>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
          <Input
            placeholder={t("admin.programs.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={language === 'ar' ? 'pr-9' : 'pl-9'}
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.programs.addProgram")}
        </Button>
      </div>

      {/* Programs Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t("admin.programs.loading")}</div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <p className="text-muted-foreground mb-4">{t("admin.programs.noPrograms")}</p>
          <Button onClick={handleAdd} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("admin.programs.addFirstProgram")}
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={language === 'ar' ? 'text-right' : 'text-left'}>{t("admin.programs.columns.program")}</TableHead>
                <TableHead className="text-center">{t("admin.programs.columns.degree")}</TableHead>
                <TableHead className="text-center">{t("admin.programs.columns.discipline")}</TableHead>
                <TableHead className="text-center">{t("admin.programs.columns.duration")}</TableHead>
                <TableHead className="text-center">{t("admin.programs.columns.fees")}</TableHead>
                <TableHead className="text-center">{t("admin.programs.columns.languages")}</TableHead>
                <TableHead className="text-center">{t("admin.programs.columns.status")}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrograms.map((program: any) => {
                const languages = languagesByProgram[program.id] || [];
                const hasLanguages = languages.length > 0 || program.language;
                
                return (
                  <TableRow key={program.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {program.csw_program_guidance?.csw_recommended && (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <span>{program.title}</span>
                        {!program.is_active && (
                          <Badge variant="secondary" className={`${language === 'ar' ? 'mr-2' : 'ml-2'} text-xs`}>{t("admin.programs.inactive")}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {program.degrees?.name || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm">
                        {program.disciplines?.name_ar || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {program.duration_months ? (
                        <span>{program.duration_months} {t("admin.programs.months")}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {program.tuition_is_free ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{t("admin.programs.free")}</Badge>
                      ) : program.tuition_usd_min || program.tuition_usd_max ? (
                        <span className="flex items-center justify-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {(program.tuition_usd_min || program.tuition_usd_max)?.toLocaleString()}
                          <span className="text-xs text-muted-foreground">USD</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasLanguages ? (
                        <div className="flex items-center justify-center gap-1">
                          <Languages className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {languages.length > 0 
                              ? languages.join(", ").toUpperCase() 
                              : program.language?.toUpperCase()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={program.publish_status === "published" ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => handleTogglePublish(program.id, program.publish_status, program)}
                      >
                        {program.publish_status === "published" ? t("admin.programs.published") : t("admin.programs.draft")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(program)}>
                            <Pencil className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                            {t("admin.programs.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTogglePublish(program.id, program.publish_status, program)}>
                            {program.publish_status === "published" ? (
                              <>
                                <Clock className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                                {t("admin.programs.unpublish")}
                              </>
                            ) : (
                              <>
                                <CheckCircle className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                                {t("admin.programs.publish")}
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(program.id, program.title)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                            {t("admin.programs.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Program Editor Modal */}
      <ProgramEditorModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedProgram(null);
        }}
        universityId={universityId}
        program={selectedProgram}
      />
    </Card>
  );
}
