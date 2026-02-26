import { AlertCircle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "success" | "info" | "warning";

interface AuthAlertProps {
  variant?: AlertVariant;
  message: string;
  className?: string;
  children?: React.ReactNode;
}

const variantConfig: Record<
  AlertVariant,
  { icon: LucideIcon; bg: string; border: string; text: string; iconColor: string }
> = {
  error: {
    icon: AlertCircle,
    bg: "bg-red-500/8 dark:bg-red-500/10",
    border: "border-red-500/20 dark:border-red-400/15",
    text: "text-red-700 dark:text-red-300",
    iconColor: "text-red-500 dark:text-red-400"
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-green-500/8 dark:bg-green-500/10",
    border: "border-green-500/20 dark:border-green-400/15",
    text: "text-green-700 dark:text-green-300",
    iconColor: "text-green-500 dark:text-green-400"
  },
  info: {
    icon: Info,
    bg: "bg-blue-500/8 dark:bg-blue-500/10",
    border: "border-blue-500/20 dark:border-blue-400/15",
    text: "text-blue-700 dark:text-blue-300",
    iconColor: "text-blue-500 dark:text-blue-400"
  },
  warning: {
    icon: AlertCircle,
    bg: "bg-amber-500/8 dark:bg-amber-500/10",
    border: "border-amber-500/20 dark:border-amber-400/15",
    text: "text-amber-700 dark:text-amber-300",
    iconColor: "text-amber-500 dark:text-amber-400"
  }
};

export function AuthAlert({ variant = "error", message, className, children }: AuthAlertProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm animate-in fade-in-0 slide-in-from-top-2 duration-300",
        config.bg,
        config.border,
        config.text,
        className
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconColor)} />
      <div className="flex-1 space-y-2">
        <p className="leading-relaxed">{message}</p>
        {children}
      </div>
    </div>
  );
}
