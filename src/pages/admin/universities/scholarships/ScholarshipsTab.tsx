import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Award, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  CheckCircle, 
  Clock,
  RefreshCw 
} from "lucide-react";

interface ScholarshipsTabProps {
  universityId: string;
}

type Scholarship = {
  id: string;
  title: string;
  description: string | null;
  coverage_type: string | null;
  eligibility: string[] | null;
  amount: number | null;
  currency_code: string | null;
  deadline: string | null;
  status: string | null;
  degree_level: string | null;
  program_id: string | null;
  programs?: { id: string; title: string } | null;
};

type Program = {
  id: string;
  title: string;
};

export default function ScholarshipsTab({ universityId }: ScholarshipsTabProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState<Scholarship | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    coverage_type: "partial",
    amount: "",
    currency_code: "USD",
    eligibility: "",
    deadline: "",
    degree_level: "",
    program_id: "",
  });

  const COVERAGE_TYPES = [
    { value: "full", label: t("admin.scholarships.coverageTypes.full") },
    { value: "partial", label: t("admin.scholarships.coverageTypes.partial") },
    { value: "tuition", label: t("admin.scholarships.coverageTypes.tuition") },
    { value: "living", label: t("admin.scholarships.coverageTypes.living") },
  ];

  // Fetch programs for this university
  const { data: programs = [] } = useQuery({
    queryKey: ["programs-for-scholarships", universityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, title")
        .eq("university_id", universityId)
        .eq("is_active", true)
        .order("title");
      if (error) throw error;
      return data as Program[];
    },
  });

  // Fetch scholarships with program info
  const { data: scholarships = [], isLoading, refetch } = useQuery({
    queryKey: ["university-scholarships", universityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scholarships")
        .select("*, programs:program_id(id, title)")
        .eq("university_id", universityId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Scholarship[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (selectedScholarship) {
        const { error } = await supabase
          .from("scholarships")
          .update(data)
          .eq("id", selectedScholarship.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("scholarships")
          .insert({ ...data, university_id: universityId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: selectedScholarship ? t("admin.scholarships.updated") : t("admin.scholarships.added") });
      queryClient.invalidateQueries({ queryKey: ["university-scholarships", universityId] });
      closeModal();
    },
    onError: (error: any) => {
      toast({ title: t("admin.scholarships.error"), description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scholarships")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("admin.scholarships.deleted") });
      queryClient.invalidateQueries({ queryKey: ["university-scholarships", universityId] });
    },
    onError: (error: any) => {
      toast({ title: t("admin.scholarships.error"), description: error.message, variant: "destructive" });
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("scholarships")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("admin.scholarships.statusUpdated") });
      queryClient.invalidateQueries({ queryKey: ["university-scholarships", universityId] });
    },
    onError: (error: any) => {
      toast({ title: t("admin.scholarships.error"), description: error.message, variant: "destructive" });
    },
  });

  const openModal = (scholarship?: Scholarship) => {
    if (scholarship) {
      setSelectedScholarship(scholarship);
      setFormData({
        title: scholarship.title || "",
        description: scholarship.description || "",
        coverage_type: scholarship.coverage_type || "partial",
        amount: scholarship.amount?.toString() || "",
        currency_code: scholarship.currency_code || "USD",
        eligibility: Array.isArray(scholarship.eligibility) ? scholarship.eligibility.join(", ") : (scholarship.eligibility || ""),
        deadline: scholarship.deadline || "",
        degree_level: scholarship.degree_level || "",
        program_id: scholarship.program_id || "",
      });
    } else {
      setSelectedScholarship(null);
      setFormData({
        title: "",
        description: "",
        coverage_type: "partial",
        amount: "",
        currency_code: "USD",
        eligibility: "",
        deadline: "",
        degree_level: "",
        program_id: "",
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedScholarship(null);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: t("admin.scholarships.error"), description: t("admin.scholarships.titleRequired"), variant: "destructive" });
      return;
    }

    saveMutation.mutate({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      coverage_type: formData.coverage_type,
      amount: formData.amount ? Number(formData.amount) : null,
      currency_code: formData.currency_code || null,
      eligibility: formData.eligibility.trim() || null,
      deadline: formData.deadline || null,
      degree_level: formData.degree_level || null,
      program_id: formData.program_id || null,
      status: "draft",
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(t("admin.scholarships.confirmDelete").replace("{title}", title))) {
      deleteMutation.mutate(id);
    }
  };

  const handleTogglePublish = (id: string, currentStatus: string | null) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    publishMutation.mutate({ id, status: newStatus });
  };

  const publishedCount = scholarships.filter(s => s.status === "published").length;
  const draftCount = scholarships.filter(s => s.status !== "published").length;

  return (
    <Card className="p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Award className="h-5 w-5" />
            {t("admin.scholarships.title")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.scholarships.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3 text-primary" />
            {publishedCount} {t("admin.scholarships.published")}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3 text-warning" />
            {draftCount} {t("admin.scholarships.draft")}
          </Badge>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button onClick={() => openModal()} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.scholarships.addScholarship")}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t("admin.scholarships.loading")}</div>
      ) : scholarships.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Award className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">{t("admin.scholarships.noScholarships")}</p>
          <Button onClick={() => openModal()} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("admin.scholarships.addFirstScholarship")}
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={language === 'ar' ? 'text-right' : 'text-left'}>{t("admin.scholarships.columns.title")}</TableHead>
                <TableHead className="text-center">{t("admin.scholarships.columns.program")}</TableHead>
                <TableHead className="text-center">{t("admin.scholarships.columns.coverageType")}</TableHead>
                <TableHead className="text-center">{t("admin.scholarships.columns.amount")}</TableHead>
                <TableHead className="text-center">{t("admin.scholarships.columns.deadline")}</TableHead>
                <TableHead className="text-center">{t("admin.scholarships.columns.status")}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scholarships.map((scholarship) => (
                <TableRow key={scholarship.id} className="group">
                  <TableCell className="font-medium">
                    {scholarship.title}
                  </TableCell>
                  <TableCell className="text-center">
                    {scholarship.programs?.title ? (
                      <Badge variant="secondary" className="text-xs">
                        {scholarship.programs.title}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">{t("admin.scholarships.forUniversity")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {COVERAGE_TYPES.find(t => t.value === scholarship.coverage_type)?.label || scholarship.coverage_type || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {scholarship.amount ? (
                      <span>
                        {scholarship.amount.toLocaleString()} {scholarship.currency_code || "USD"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {scholarship.deadline || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={scholarship.status === "published" ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleTogglePublish(scholarship.id, scholarship.status)}
                    >
                      {scholarship.status === "published" ? t("admin.scholarships.published") : t("admin.scholarships.draft")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background">
                        <DropdownMenuItem onClick={() => openModal(scholarship)}>
                          <Pencil className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                          {t("admin.scholarships.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(scholarship.id, scholarship.title)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                          {t("admin.scholarships.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedScholarship ? t("admin.scholarships.modal.editTitle") : t("admin.scholarships.modal.addTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t("admin.scholarships.modal.scholarshipTitle")}</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                placeholder={t("admin.scholarships.modal.scholarshipTitlePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("admin.scholarships.modal.description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder={t("admin.scholarships.modal.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.scholarships.modal.coverageType")}</Label>
                <Select
                  value={formData.coverage_type}
                  onValueChange={(val) => setFormData(p => ({ ...p, coverage_type: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {COVERAGE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("admin.scholarships.modal.degreeLevel")}</Label>
                <Select
                  value={formData.degree_level}
                  onValueChange={(val) => setFormData(p => ({ ...p, degree_level: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.scholarships.modal.selectDegree")} />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="bachelor">{t("admin.scholarships.modal.bachelor")}</SelectItem>
                    <SelectItem value="master">{t("admin.scholarships.modal.master")}</SelectItem>
                    <SelectItem value="phd">{t("admin.scholarships.modal.phd")}</SelectItem>
                    <SelectItem value="all">{t("admin.scholarships.modal.all")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.scholarships.modal.amount")}</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))}
                  placeholder="5000"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("admin.scholarships.modal.currency")}</Label>
                <Input
                  value={formData.currency_code}
                  onChange={(e) => setFormData(p => ({ ...p, currency_code: e.target.value.toUpperCase() }))}
                  placeholder="USD"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.scholarships.modal.eligibility")}</Label>
              <Textarea
                value={formData.eligibility}
                onChange={(e) => setFormData(p => ({ ...p, eligibility: e.target.value }))}
                placeholder={t("admin.scholarships.modal.eligibilityPlaceholder")}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("admin.scholarships.modal.deadline")}</Label>
              <Input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData(p => ({ ...p, deadline: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("admin.scholarships.modal.linkedProgram")}</Label>
              <Select
                value={formData.program_id}
                onValueChange={(val) => setFormData(p => ({ ...p, program_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.scholarships.modal.selectProgram")} />
                </SelectTrigger>
                <SelectContent className="bg-background max-h-60">
                  {programs.map(prog => (
                    <SelectItem key={prog.id} value={prog.id}>{prog.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={closeModal}>
                {t("admin.scholarships.modal.cancel")}
              </Button>
              <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                {t("admin.scholarships.modal.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
