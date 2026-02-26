import { useMutation } from "@tanstack/react-query";
import { CalendarClock, Loader2, Mail } from "lucide-react";
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

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const forgotMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password"
      });
      if (error) {
        throw new Error(error.message ?? "Failed to send reset email");
      }
    },
    onSuccess: () => {
      setSent(true);
    }
  });

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    forgotMutation.mutate(email);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/15">
                <Mail className="h-7 w-7 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Check your email</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  If an account exists for{" "}
                  <span className="font-medium text-foreground">{email}</span>, we've sent a
                  password reset link.
                </p>
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <CalendarClock className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email and we'll send a reset link
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="sr-only">
            <CardTitle>Forgot Password</CardTitle>
            <CardDescription>Reset your password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {forgotMutation.error ? (
                <AuthAlert variant="error" message={forgotMutation.error.message} />
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

              <Button type="submit" className="w-full" disabled={forgotMutation.isPending}>
                {forgotMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send reset link"
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
