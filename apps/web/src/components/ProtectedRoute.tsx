import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Preserve the URL the user was trying to visit
    const redirect =
      location.pathname !== "/" ? `?redirect=${encodeURIComponent(location.pathname)}` : "";
    return <Navigate to={`/login${redirect}`} replace />;
  }

  return <Outlet />;
}
