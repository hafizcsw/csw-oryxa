import { Navigate } from "react-router-dom";

export default function AccountApplications() {
  return <Navigate to="/account?tab=applications" replace />;
}
