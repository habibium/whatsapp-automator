import { CheckCircle, HelpCircle, Loader2, Smartphone, Unplug, Wifi } from "lucide-react";
import { useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useWhatsApp } from "../hooks/useWhatsApp";

export function ConnectPage() {
  const { status, qrCode, loading, connect, disconnect } = useWhatsApp();

  useEffect(() => {
    if (status !== "connected" && !loading) {
      connect();
    }
  }, [status, loading, connect]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp Connection</h1>
        <p className="mt-1 text-muted-foreground">
          Link your WhatsApp account to send scheduled messages
        </p>
      </div>

      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center py-10">
          {status === "connected" ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">Connected</h2>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Your WhatsApp account is connected and ready to send messages.
              </p>
              <Button
                variant="destructive"
                className="mt-6"
                onClick={disconnect}
                disabled={loading}
              >
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </>
          ) : status === "awaiting_qr" && qrCode ? (
            <>
              <div className="rounded-xl border border-border bg-white p-3">
                <img src={qrCode} alt="WhatsApp QR Code" className="h-56 w-56" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">Scan QR Code</h2>
              <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">
                Open WhatsApp on your phone, go to{" "}
                <span className="font-medium text-foreground">
                  Settings &rarr; Linked Devices &rarr; Link a Device
                </span>
                , and scan this code.
              </p>
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <h2 className="mt-4 text-xl font-semibold">
                {status === "connecting" ? "Connecting..." : "Loading..."}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Please wait while we establish the connection.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Help section */}
      <Card className="mx-auto max-w-lg">
        <CardContent className="py-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            Need help?
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Make sure your phone has an active internet connection
            </li>
            <li className="flex items-start gap-2">
              <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Keep WhatsApp open on your phone during the scan
            </li>
            <li className="flex items-start gap-2">
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              If the QR code expires, the page will automatically refresh
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Your session will remain active until you manually disconnect
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
