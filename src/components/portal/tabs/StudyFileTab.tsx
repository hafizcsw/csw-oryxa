import { lazy, Suspense } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FolderOpen } from "lucide-react";
import { FileQualityCard } from "@/components/file-quality/FileQualityCard";
import { FileQualityGapList } from "@/components/file-quality/FileQualityGapList";
import { FileQualityGate } from "@/components/file-quality/FileQualityGate";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  fileQuality?: FileQualityResult | null;
}

function SectionSkeleton() {
  return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
}

// Typed filter arrays (stable references)
const PHOTO_FILTER: DocumentTypeFilter[] = ['photo'];
const PASSPORT_FILTER: DocumentTypeFilter[] = ['passport'];
const CERTIFICATE_FILTER: DocumentTypeFilter[] = ['certificate'];
const ADDITIONAL_FILTER: DocumentTypeFilter[] = ['additional'];

export function StudyFileTab({ profile, crmProfile, onUpdate, onRefetch, onTabChange, fileQuality }: StudyFileTabProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FolderOpen className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">{t('portal.sidebar.myStudyFile')}</h1>
      </div>

      {/* 1. File Quality */}
      {fileQuality && (
        <section>
          <h2 className="text-base font-semibold text-foreground mb-4">{t('portal.studyFile.quality')}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <FileQualityCard result={fileQuality} />
              <FileQualityGate gates={fileQuality.gates} />
            </div>
            <div className="lg:col-span-2">
              <FileQualityGapList
                blockingGaps={fileQuality.blocking_gaps}
                improvementGaps={fileQuality.improvement_gaps}
              />
            </div>
          </div>
        </section>
      )}

      <Separator />

      {/* 2. Profile Photo — at the top */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-4">{t('portal.documents.photo')}</h2>
        <Suspense fallback={<SectionSkeleton />}>
          <DocumentsTab
            profile={profile}
            crmProfile={crmProfile}
            onUpdate={onUpdate}
            docTypesFilter={PHOTO_FILTER}
            compact
          />
        </Suspense>
      </section>

      <Separator />

      {/* 3. Personal Info + Passport side by side */}
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

      {/* 4. Readiness + Certificate side by side */}
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

      {/* 5. Additional Documents */}
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
