import type { ConnectionStatus } from "@pkg/shared";
import { Link } from "react-router";
import { useWhatsAppStatus } from "@/hooks/use-whatsapp";
import { cn } from "@/lib/utils";

const LABELS: Record<ConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  qr: "Scan QR",
  disconnected: "Not linked"
};

const DOT_COLORS: Record<ConnectionStatus, string> = {
  connected: "bg-green-500",
  connecting: "bg-amber-500",
  qr: "bg-amber-500",
  disconnected: "bg-muted-foreground"
};

/** Compact WhatsApp connection indicator shown in the app header. */
export function ConnectionBadge() {
  const { data } = useWhatsAppStatus();
  const status = data?.status ?? "disconnected";

  return (
    <Link
      to="/connect"
      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
    >
      <span className={cn("size-2 rounded-full", DOT_COLORS[status])} />
      <span className="hidden sm:inline">{LABELS[status]}</span>
    </Link>
  );
}
