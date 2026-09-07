import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function ProtectedRoute() {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading)
    return <section className="panel">Checking your account...</section>;
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
