import { useMutation } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { type SubmitEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthAlert } from "../components/AuthAlert";
import { Footer } from "../components/Footer";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { authClient } from "../lib/auth-client";
import { useAuthStore } from "../stores/auth";

/** Detect if a Better Auth error message indicates an unverified email */
function isUnverifiedEmailError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("email is not verified") ||
    lower.includes("email not verified") ||
    lower.includes("verify your email") ||
    lower.includes("email_not_verified")
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const refresh = useAuthStore((s) => s.refresh);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        throw new Error(error.message ?? "Sign in failed");
      }
    },
    onSuccess: async () => {
      await refresh();
      navigate(redirect);
    }
  });

  const resendMutation = useMutation({
    mutationFn: async (userEmail: string) => {
      const { error } = await authClient.sendVerificationEmail({ email: userEmail });
      if (error) throw new Error(error.message ?? "Failed to send verification email");
    },
    onSuccess: () => setResendSuccess(true)
  });

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setResendSuccess(false);
    loginMutation.mutate({ email, password });
  };

  const errorMsg = loginMutation.error?.message ?? null;
  const isUnverified = errorMsg ? isUnverifiedEmailError(errorMsg) : false;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <CalendarClock className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">WhatsApp Scheduler</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
          </div>
        </div>

        <Card>
          <CardHeader className="sr-only">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ── Unverified email alert ── */}
              {isUnverified ? (
                <AuthAlert
                  variant="warning"
                  message="Your email address hasn't been verified yet. We've sent a new verification link — check your inbox."
                >
                  {resendSuccess ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verification email sent!
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-2 opacity-80 transition-opacity hover:opacity-100 disabled:opacity-50"
                      onClick={() => resendMutation.mutate(email)}
                      disabled={resendMutation.isPending}
                    >
                      {resendMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Resend verification email
                    </button>
                  )}
                </AuthAlert>
              ) : errorMsg ? (
                <AuthAlert variant="error" message={errorMsg} />
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Create one
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
      <div className="mt-8">
        <Footer />
      </div>
    </div>
  );
}
