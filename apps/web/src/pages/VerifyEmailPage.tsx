import { useMutation } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  MailWarning,
  RefreshCw,
  XCircle
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { authClient } from "../lib/auth-client";
import { getApiOrigin } from "../lib/public-url";
import { useAuthStore } from "../stores/auth";

type VerifyStatus = "verifying" | "success" | "expired" | "error";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const refresh = useAuthStore((s) => s.refresh);
  const [status, setStatus] = useState<VerifyStatus>("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(3);
  const didRun = useRef(false);

  // Verify the email token on mount
  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid verification link. No token found.");
      return;
    }

    const verify = async () => {
      try {
        const apiBase = getApiOrigin();

        // Use redirect: "manual" so we can distinguish success (302 redirect)
        // from failure (4xx JSON response). The browser still processes
        // Set-Cookie headers from the 302 response, so the session cookie
        // is stored before we check getSession().
        const response = await fetch(
          `${apiBase}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent("/")}`,
          { credentials: "include", redirect: "manual" }
        );

        // A 302 redirect means verification succeeded.
        // With redirect: "manual", the browser returns an opaque redirect
        // response (type "opaqueredirect", status 0) but still processes
        // Set-Cookie headers from it.
        const isRedirect =
          response.type === "opaqueredirect" || response.status === 302 || response.status === 301;

        if (isRedirect) {
          // Email verified! The session cookie should have been set by
          // Better Auth (autoSignInAfterVerification: true).
          // Give a tiny delay for cookie processing then check session.
          await new Promise((r) => setTimeout(r, 200));
          const { data } = await authClient.getSession();
          if (data?.session) {
            await refresh();
          }
          // Show success regardless — email IS verified even if the
          // auto-sign-in cookie didn't propagate (user can log in manually).
          setStatus("success");
          return;
        }

        // Non-redirect response = verification failed (expired / invalid token).
        // Better Auth returns a JSON error body.
        let msg = "Verification failed. Please try again.";
        try {
          const json = await response.json();
          msg = json?.message || json?.error?.message || json?.error || msg;
        } catch {
          // response body wasn't JSON — ignore
        }

        if (
          msg.toLowerCase().includes("expired") ||
          msg.toLowerCase().includes("expire") ||
          response.status === 400
        ) {
          setStatus("expired");
          setErrorMessage(msg);
        } else {
          setStatus("error");
          setErrorMessage(msg);
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Something went wrong during verification."
        );
      }
    };

    verify();
  }, [token, refresh]);

  // Countdown + auto-redirect on success
  useEffect(() => {
    if (status !== "success") return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/", { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, navigate]);

  // Resend verification email
  const resendMutation = useMutation({
    mutationFn: async (userEmail: string) => {
      const { error } = await authClient.sendVerificationEmail({ email: userEmail });
      if (error) throw new Error(error.message ?? "Failed to send verification email");
    }
  });

  // ── Verifying ────────────────────────────────────────────────────
  if (status === "verifying") {
    return (
      <PageShell>
        <Card>
          <CardContent className="flex flex-col items-center gap-5 pt-10 pb-10 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Verifying your email</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Hang tight, this will only take a moment...
              </p>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Success ──────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <PageShell>
        <Card className="overflow-hidden">
          {/* Decorative gradient bar */}
          <div className="h-1.5 bg-linear-to-r from-green-400 via-emerald-500 to-teal-500" />
          <CardContent className="flex flex-col items-center gap-5 pt-8 pb-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 ring-4 ring-green-500/5 animate-in zoom-in-50 duration-500">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-150">
              <h2 className="text-lg font-semibold">Email verified!</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Your account is ready. Redirecting you in{" "}
                <span className="tabular-nums font-medium text-foreground">{countdown}s</span>...
              </p>
            </div>
            <Button
              variant="default"
              className="mt-1 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-300"
              onClick={() => navigate("/", { replace: true })}
            >
              Continue to app
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Expired ──────────────────────────────────────────────────────
  if (status === "expired") {
    return (
      <PageShell>
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-linear-to-r from-amber-400 via-orange-500 to-red-400" />
          <CardContent className="flex flex-col items-center gap-5 pt-8 pb-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 ring-4 ring-amber-500/5 animate-in zoom-in-50 duration-500">
              <MailWarning className="h-8 w-8 text-amber-500" />
            </div>
            <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-150">
              <h2 className="text-lg font-semibold">Link expired</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {errorMessage || "This verification link has expired."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email below and we'll send a fresh one.
              </p>
            </div>

            {resendMutation.isSuccess ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2.5 text-sm text-green-600 dark:text-green-400 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Verification email sent! Check your inbox.</span>
              </div>
            ) : (
              <form
                className="flex w-full max-w-xs flex-col gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-300"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) resendMutation.mutate(email.trim());
                }}
              >
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {resendMutation.error ? (
                  <p className="text-xs text-destructive-foreground">
                    {resendMutation.error.message}
                  </p>
                ) : null}
                <Button type="submit" className="w-full gap-2" disabled={resendMutation.isPending}>
                  {resendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Resend verification email
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/login" className="text-sm text-muted-foreground hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </PageShell>
    );
  }

  // ── Generic Error ────────────────────────────────────────────────
  return (
    <PageShell>
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-linear-to-r from-red-400 via-rose-500 to-pink-500" />
        <CardContent className="flex flex-col items-center gap-5 pt-8 pb-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 ring-4 ring-red-500/5 animate-in zoom-in-50 duration-500">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-150">
            <h2 className="text-lg font-semibold">Verification failed</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {errorMessage || "We couldn't verify your email. The link may be invalid."}
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-center gap-3">
          <Link to="/login" className="text-sm text-muted-foreground hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </PageShell>
  );
}

// ── Layout wrapper ────────────────────────────────────────────────
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <CalendarClock className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">WA Scheduler</h1>
        </div>
        {children}
      </div>
      <div className="mt-8">
        <Footer />
      </div>
    </div>
  );
}
