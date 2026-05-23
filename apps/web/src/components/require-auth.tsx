import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useSession } from "@/lib/auth";

/** Route guard: redirects unauthenticated visitors to the login page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
