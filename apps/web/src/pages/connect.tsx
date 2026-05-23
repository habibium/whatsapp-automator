import { CheckCircle2Icon, Loader2Icon, SmartphoneIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useConnectWhatsApp,
  useDisconnectWhatsApp,
  useLogoutWhatsApp,
  useWhatsAppStatus
} from "@/hooks/use-whatsapp";

export function ConnectPage() {
  const { data } = useWhatsAppStatus({ poll: true });
  const connect = useConnectWhatsApp();
  const disconnect = useDisconnectWhatsApp();
  const logout = useLogoutWhatsApp();
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const status = data?.status ?? "disconnected";

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp connection</CardTitle>
          <CardDescription>
            Link your WhatsApp account so the scheduler can deliver messages on your behalf.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-5 pb-8 text-center">
          {status === "disconnected" && (
            <>
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <SmartphoneIcon className="size-7" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your WhatsApp account is not linked yet.
              </p>
              <Button
                onClick={() =>
                  connect.mutate(undefined, { onError: (e) => toast.error(e.message) })
                }
                disabled={connect.isPending}
              >
                {connect.isPending ? "Starting…" : "Link WhatsApp"}
              </Button>
            </>
          )}

          {status === "connecting" && (
            <>
              <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Connecting to WhatsApp…</p>
            </>
          )}

          {status === "qr" && (
            <>
              {data?.qr ? (
                <img
                  src={data.qr}
                  alt="WhatsApp pairing QR code"
                  className="size-60 rounded-lg border bg-white p-2"
                />
              ) : (
                <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
              )}
              <ol className="space-y-1 text-left text-sm text-muted-foreground">
                <li>1. Open WhatsApp on your phone</li>
                <li>2. Go to Settings → Linked devices</li>
                <li>3. Tap "Link a device" and scan this code</li>
              </ol>
            </>
          )}

          {status === "connected" && (
            <>
              <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                <CheckCircle2Icon className="size-8" />
              </div>
              <div>
                <p className="font-medium">WhatsApp connected</p>
                {data?.phoneNumber ? (
                  <p className="text-sm text-muted-foreground">{data.phoneNumber}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    disconnect.mutate(undefined, { onError: (e) => toast.error(e.message) })
                  }
                  disabled={disconnect.isPending}
                >
                  Disconnect
                </Button>
                <Button variant="destructive" onClick={() => setConfirmUnlink(true)}>
                  Unlink device
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        title="Unlink WhatsApp?"
        description="This signs the device out of WhatsApp. Scheduled messages will not send until you link again."
        confirmLabel="Unlink"
        destructive
        onConfirm={() =>
          logout.mutate(undefined, {
            onSuccess: () => toast.success("WhatsApp unlinked"),
            onError: (e) => toast.error(e.message)
          })
        }
      />
    </div>
  );
}
