import { AdminImportPage } from '@/features/admin-import';
import ProtectedRoute from '@/components/admin/ProtectedRoute';

export default function AdminImport() {
  return (
    <ProtectedRoute>
      <AdminImportPage />
    </ProtectedRoute>
  );
}
