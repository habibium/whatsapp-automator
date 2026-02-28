import {
  CheckCircle,
  HelpCircle,
  Loader2,
  RefreshCw,
  Smartphone,
  Unplug,
  Wifi
} from "lucide-react";
import { useEffect } from "react";
import { useWhatsAppStore } from "../stores/whatsapp";
import { Button } from "./ui/button";

const steps = [
  { num: 1, text: "Open WhatsApp on your phone" },
  {
    num: 2,
    text: (
      <>
        Tap <span className="font-semibold text-foreground">Menu</span> or{" "}
        <span className="font-semibold text-foreground">Settings</span> &rarr;{" "}
        <span className="font-semibold text-foreground">Linked Devices</span>
      </>
    )
  },
  {
    num: 3,
    text: (
      <>
        Tap <span className="font-semibold text-foreground">Link a Device</span> and scan this code
      </>
    )
  }
] as const;

function QRCodeView({ qrCode }: { qrCode: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-8 md:flex-row md:items-start md:gap-12">
      {/* Instructions — left side on desktop, below on mobile */}
      <div className="order-2 flex flex-1 flex-col md:order-1">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Scan to connect</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Link your WhatsApp account to start scheduling messages.
        </p>

        <ol className="mt-8 space-y-5">
          {steps.map((step) => (
            <li key={step.num} className="flex items-start gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
                {step.num}
              </span>
              <span className="pt-0.5 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </span>
            </li>
          ))}
        </ol>

        {/* Tips */}
        <div className="mt-8 rounded-xl border border-border/60 bg-muted/30 px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
            Tips
          </div>
          <ul className="mt-2.5 space-y-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <Smartphone className="mt-0.5 h-3 w-3 shrink-0" />
              Phone must have an active internet connection
            </li>
            <li className="flex items-start gap-2">
              <Wifi className="mt-0.5 h-3 w-3 shrink-0" />
              Keep WhatsApp open during the scan
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-3 w-3 shrink-0" />
              Session stays active until you disconnect
            </li>
          </ul>
        </div>
      </div>

      {/* QR Code — right side on desktop, top on mobile */}
      <div className="order-1 flex shrink-0 flex-col items-center md:order-2">
        <div className="rounded-2xl border border-border/60 bg-white p-3 shadow-lg shadow-black/5">
          <img src={qrCode} alt="WhatsApp QR Code" className="h-56 w-56 sm:h-64 sm:w-64" />
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          QR code refreshes automatically
        </p>
      </div>
    </div>
  );
}

function ConnectingView() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
      <h2 className="mt-5 text-xl font-semibold">Connecting...</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Please wait while we establish the connection.
      </p>
    </div>
  );
}

function DisconnectedView({ onConnect, loading }: { onConnect: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Unplug className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="mt-5 text-xl font-semibold">Connect WhatsApp</h2>
      <p className="mt-1.5 max-w-sm text-center text-sm text-muted-foreground">
        Link your WhatsApp account to create and manage scheduled messages.
      </p>
      <Button className="mt-6" size="lg" onClick={onConnect} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Connect WhatsApp
      </Button>
    </div>
  );
}

export function WhatsAppConnect() {
  const { status, qrCode, loading, connect } = useWhatsAppStore();

  const isAwaitingQR = status === "awaiting_qr";
  const isConnecting = status === "connecting" || (loading && status === "disconnected");
  const isDisconnected = status === "disconnected" && !loading;

  // Auto-connect when component mounts and status is determined to be disconnected
  useEffect(() => {
    if (isDisconnected) {
      connect();
    }
  }, [isDisconnected, connect]);

  return (
    <div className="flex flex-1 items-center justify-center px-2">
      <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-10">
        {isAwaitingQR && qrCode ? (
          <QRCodeView qrCode={qrCode} />
        ) : isConnecting || loading ? (
          <ConnectingView />
        ) : (
          <DisconnectedView onConnect={connect} loading={loading} />
        )}
      </div>
    </div>
  );
}
