import { useTranslation } from 'react-i18next';
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';
import { StudentInbox } from '@/components/comm/StudentInbox';

interface Props {
  operatingSystemData?: StudentOperatingSystemData | null;
}

export function DashboardMessagesTab({ operatingSystemData }: Props) {
  if (!operatingSystemData) return null;

  return (
    <div className="h-[600px] border border-border rounded-lg overflow-hidden">
      <StudentInbox />
    </div>
  );
}
