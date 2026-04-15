import { lazy, Suspense } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FolderOpen } from "lucide-react";
import { FileQualityCard } from "@/components/file-quality/FileQualityCard";
import { CanonicalFileSummary } from "@/components/student-file/CanonicalFileSummary";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountContentHeader } from "@/components/portal/account/AccountContentHeader";
import { useCanonicalStudentFile } from "@/hooks/useCanonicalStudentFile";
import { useStudentDocuments } from "@/hooks/useStudentDocuments";
import type { FileQualityResult } from "@/features/file-quality/types";
import type { DocumentTypeFilter } from "./DocumentsTab";

const ProfileTab = lazy(() => import("@/components/portal/tabs/ProfileTab").then(m => ({ default: m.ProfileTab })));
const ReadinessTab = lazy(() => import("@/components/readiness/ReadinessTab").then(m => ({ default: m.ReadinessTab })));
const DocumentsTab = lazy(() => import("@/components/portal/tabs/DocumentsTab").then(m => ({ default: m.DocumentsTab })));

interface StudyFileTabProps {
  profile: any;
  crmProfile: any;
  onUpdate: (data: any) => Promise<any>;
  onRefetch: () => Promise<any>;
  onTabChange: (tab: string) => void;
  onAvatarUpdate?: (path: string | null) => Promise<boolean>;
  fileQuality?: FileQualityResult | null;
}

function SectionSkeleton() {
  return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
}

const PASSPORT_FILTER: DocumentTypeFilter[] = ['passport'];
const CERTIFICATE_FILTER: DocumentTypeFilter[] = ['certificate'];
const ADDITIONAL_FILTER: DocumentTypeFilter[] = ['additional'];

export function StudyFileTab({ profile, crmProfile, onUpdate, onRefetch, onTabChange, onAvatarUpdate, fileQuality }: StudyFileTabProps) {
  const { t } = useLanguage();
  const { documents } = useStudentDocuments();

  // ═══ Door 1: First runtime consumer of CanonicalStudentFile ═══
  const { canonicalFile, hasIdentity, hasAcademic, hasLanguage, hasTargeting } = useCanonicalStudentFile({
    crmProfile,
    documents,
    userId: profile?.user_id ?? null,
  });

  return (
    <div className="space-y-8" data-canonical-status={canonicalFile?.file_status.profile_completion_status ?? 'none'}>
      {/* Top: Avatar (circle) + Page Title */}
      <div className="flex items-center gap-4">
        <AccountContentHeader
          profile={profile}
          crmProfile={crmProfile}
          onAvatarUpdate={onAvatarUpdate}
        />
      </div>

      {/* 1. File Quality */}
      {fileQuality && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-2">{t('portal.studyFile.quality')}</h2>
          <FileQualityCard result={fileQuality} />
        </section>
      )}

      <Separator />

      {/* 2. Personal Info + Passport side by side */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-4">{t('portal.sidebar.profile')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Suspense fallback={<SectionSkeleton />}>
              <ProfileTab profile={profile} crmProfile={crmProfile} onUpdate={onUpdate} onRefetch={onRefetch} onTabChange={onTabChange} />
            </Suspense>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('portal.documents.passport')}</h3>
            <Suspense fallback={<SectionSkeleton />}>
              <DocumentsTab
                profile={profile}
                crmProfile={crmProfile}
                onUpdate={onUpdate}
                docTypesFilter={PASSPORT_FILTER}
                compact
              />
            </Suspense>
          </div>
        </div>
      </section>

      <Separator />

      {/* 3. Readiness + Certificate side by side */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-4">{t('portal.sidebar.readiness')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Suspense fallback={<SectionSkeleton />}>
              <ReadinessTab onTabChange={onTabChange} />
            </Suspense>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('portal.documents.certificate')}</h3>
            <Suspense fallback={<SectionSkeleton />}>
              <DocumentsTab
                profile={profile}
                crmProfile={crmProfile}
                onUpdate={onUpdate}
                docTypesFilter={CERTIFICATE_FILTER}
                compact
              />
            </Suspense>
          </div>
        </div>
      </section>

      <Separator />

      {/* 4. Additional Documents */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-4">{t('portal.sidebar.documents')}</h2>
        <Suspense fallback={<SectionSkeleton />}>
          <DocumentsTab
            profile={profile}
            crmProfile={crmProfile}
            onUpdate={onUpdate}
            onTabChange={onTabChange}
            docTypesFilter={ADDITIONAL_FILTER}
            compact
          />
        </Suspense>
      </section>
    </div>
  );
}
