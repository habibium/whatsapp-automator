import { useMutation } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { type SubmitEvent, useState } from "react";
import { Link } from "react-router-dom";
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

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const registerMutation = useMutation({
    mutationFn: async ({
      name,
      email,
      password
    }: {
      name: string;
      email: string;
      password: string;
    }) => {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: window.location.origin + "/"
      });
      if (error) {
        throw new Error(error.message ?? "Registration failed");
      }
    },
    onSuccess: () => {
      setRegistered(true);
    }
  });

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError("Name is required");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    registerMutation.mutate({ name, email, password });
  };

  const error = validationError ?? registerMutation.error?.message ?? null;

  // ── Email verification pending ──────────────────────────────────
  if (registered) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
                <Mail className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Check your email</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  We've sent a verification link to{" "}
                  <span className="font-medium text-foreground">{email}</span>. Click the link to
                  activate your account.
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span>The link expires in 1 hour</span>
              </div>
            </CardContent>
            <CardFooter className="justify-center">
              <Link to="/login" className="text-sm font-medium text-primary hover:underline">
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

  // ── Registration form ───────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <CalendarClock className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Start scheduling your WhatsApp messages
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="sr-only">
            <CardTitle>Register</CardTitle>
            <CardDescription>Create a new account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? <AuthAlert variant="error" message={error} /> : null}

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

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
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
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
