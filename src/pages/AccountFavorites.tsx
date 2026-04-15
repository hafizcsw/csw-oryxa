import { Navigate } from "react-router-dom";

export default function AccountFavoritesPage() {
  return <Navigate to="/account?tab=shortlist" replace />;
}
