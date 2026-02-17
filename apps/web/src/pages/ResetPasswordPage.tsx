import { useMutation } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { type SubmitEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Alert, AlertDescription } from "../components/ui/alert";
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

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await authClient.resetPassword({ newPassword, token });
      if (error) {
        throw new Error(error.message ?? "Failed to reset password");
      }
    },
    onSuccess: () => {
      setSuccess(true);
    }
  });

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    resetMutation.mutate(password);
  };

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
            <h2 className="text-lg font-semibold">Invalid reset link</h2>
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary hover:underline"
            >
              Request a new link
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Password reset successful</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your password has been updated. You can now sign in with your new password.
                </p>
              </div>
            </CardContent>
            <CardFooter className="justify-center">
              <Link to="/login" className="text-sm font-medium text-primary hover:underline">
                Sign in
              </Link>
            </CardFooter>
          </Card>
        </div>
        <div className="mt-8">
          <Footer />
        </div>
      </div>
    );
  }

  const error = validationError ?? resetMutation.error?.message ?? null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <CalendarClock className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">New password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a strong password for your account
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="sr-only">
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your new password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Reset password"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/login" className="text-sm text-muted-foreground hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
      <div className="mt-8">
        <Footer />
      </div>
    </div>
  );
}
