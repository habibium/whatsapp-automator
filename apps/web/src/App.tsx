import { QueryClientProvider } from "@tanstack/react-query";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router";
import { AppLayout } from "@/components/app-layout";
import { RequireAuth } from "@/components/require-auth";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { queryClient } from "@/lib/query";
import { ConnectPage } from "@/pages/connect";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { HistoryPage } from "@/pages/history";
import { LoginPage } from "@/pages/login";
import { MessagesPage } from "@/pages/messages";
import { NotFoundPage } from "@/pages/not-found";
import { ResetPasswordPage } from "@/pages/reset-password";
import { SignupPage } from "@/pages/signup";
import { TemplatesPage } from "@/pages/templates";

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/messages" replace /> },
      { path: "messages", element: <MessagesPage /> },
      { path: "templates", element: <TemplatesPage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "connect", element: <ConnectPage /> }
    ]
  },
  { path: "*", element: <NotFoundPage /> }
]);

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
