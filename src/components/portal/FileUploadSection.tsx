import { useState, useRef } from "react";
import { Upload, File, Download, Trash2, Loader2, FileText, Image, FileArchive } from "lucide-react";
import { IconBox } from "@/components/ui/icon-box";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DocumentTypeCard } from "./DocumentTypeCard";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface CustomerFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  document_category?: string | null;
}

interface Props {
  profileId: string;
  files: CustomerFile[];
  onRefresh: () => Promise<void>;
}

export function FileUploadSection({ profileId, files, onRefresh }: Props) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docTypeInputRef = useRef<HTMLInputElement>(null);

  const REQUIRED_DOCUMENTS = [
    { id: 'passport', nameKey: 'portal.documents.passport', descriptionKey: 'portal.documents.passportDesc', required: true },
    { id: 'photo', nameKey: 'portal.documents.photo', descriptionKey: 'portal.documents.photoDesc', required: true },
    { id: 'certificate', nameKey: 'portal.documents.certificate', descriptionKey: 'portal.documents.certificateDesc', required: true },
    { id: 'transcript', nameKey: 'portal.documents.transcript', descriptionKey: 'portal.documents.transcriptDesc', required: true },
    { id: 'language', nameKey: 'portal.documents.language', descriptionKey: 'portal.documents.languageDesc', required: false },
    { id: 'other', nameKey: 'portal.documents.other', descriptionKey: 'portal.documents.otherDesc', required: false },
  ];

  const getDocumentStatus = (docId: string): 'uploaded' | 'pending' | 'reviewing' | 'rejected' => {
    const hasFile = files.some(f => f.document_category === docId);
    return hasFile ? 'uploaded' : 'pending';
  };

  const getFileName = (docId: string): string | undefined => {
    const file = files.find(f => f.document_category === docId);
    return file?.file_name;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, docCategory?: string) => {
    if (!e.target.files?.[0] || !profileId) return;
    
    const file = e.target.files[0];
    setUploading(true);
    if (docCategory) setUploadingDocType(docCategory);

    try {
      const clean = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `user/${profileId}/${Date.now()}_${clean}`;

      const { error: uploadError } = await supabase.storage
        .from('student-docs')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('customer_files')
        .insert([{
          profile_id: profileId,
          file_name: file.name,
          file_path: path,
          storage_path: path,
          file_type: file.type || null,
          file_size: file.size,
          document_category: docCategory || null,
        }]);

      if (insertError) throw insertError;

      await onRefresh();
      
      toast({
        title: t('portal.files.uploadSuccess'),
        description: t('portal.files.uploadSuccessDesc'),
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error?.message || t('portal.files.uploadError'),
      });
    } finally {
      setUploading(false);
      setUploadingDocType(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleDocTypeUpload = (docType: string) => {
    setUploadingDocType(docType);
    docTypeInputRef.current?.click();
  };

  const handleDownload = async (file: CustomerFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('student-docs')
        .createSignedUrl(file.file_path, 60);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error('No signed URL');

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('portal.files.downloadError'),
      });
    }
  };

  const handleDelete = async (file: CustomerFile) => {
    if (!confirm(t('portal.files.deleteConfirm'))) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('student-docs')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('customer_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      await onRefresh();

      toast({
        title: t('portal.files.deleteSuccess'),
        description: t('portal.files.deleteSuccessDesc'),
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('portal.files.deleteError'),
      });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const fakeEvent = { target: { files: droppedFiles, value: '' } } as any;
      await handleUpload(fakeEvent);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string | null) => {
    if (type?.startsWith('image/')) return Image;
    if (type?.includes('zip') || type?.includes('rar')) return FileArchive;
    return FileText;
  };

  // Files not categorized
  const uncategorizedFiles = files.filter(f => !f.document_category);
  const dateLocale = language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <div className="space-y-6">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleUpload(e)}
        disabled={uploading}
      />
      <input
        ref={docTypeInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleUpload(e, uploadingDocType || undefined)}
        disabled={uploading}
      />

      {/* Document Types Grid */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-foreground">{t('portal.documents.requiredTitle')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('portal.documents.requiredDesc')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REQUIRED_DOCUMENTS.map((doc) => (
            <DocumentTypeCard
              key={doc.id}
              document={{
                id: doc.id,
                name: t(doc.nameKey),
                description: t(doc.descriptionKey),
                required: doc.required,
                status: getDocumentStatus(doc.id),
                fileName: getFileName(doc.id),
              }}
              onUpload={handleDocTypeUpload}
            />
          ))}
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`bg-card rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
      >
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
        <p className="text-foreground font-medium mb-2">
          {isDragging ? t('portal.files.dropHere') : t('portal.files.dragDrop')}
        </p>
        <p className="text-sm text-muted-foreground mb-4">{t('common.or')}</p>
        <Button
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              {t('portal.files.uploading')}
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 ml-2" />
              {t('portal.files.chooseFile')}
            </>
          )}
        </Button>
      </div>

      {/* Uncategorized Files List */}
      {uncategorizedFiles.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h4 className="text-lg font-bold text-foreground mb-4">{t('portal.files.otherFiles')}</h4>
          <div className="space-y-3">
            {uncategorizedFiles.map((file, index) => {
              const FileIcon = getFileIcon(file.file_type);
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl border border-border hover:border-primary/30 transition-colors"
                >
                  <IconBox icon={FileIcon} size="lg" variant="primary" />

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {file.file_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatFileSize(file.file_size)} • {new Date(file.uploaded_at).toLocaleDateString(dateLocale)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(file)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
