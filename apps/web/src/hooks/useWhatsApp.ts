import { useCallback, useEffect, useRef, useState } from "react";
import { api, type WhatsAppStatus } from "../lib/api";

type QREvent =
  | { type: "qr"; data: string }
  | { type: "connected" }
  | { type: "disconnected"; reason?: string };

export function useWhatsApp() {
  const [status, setStatus] = useState<WhatsAppStatus>("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchStatus = useCallback(async () => {
    const result = await api.whatsapp.status();
    if (result.success) {
      setStatus(result.data.status);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const connect = useCallback(async () => {
    // Idempotent: skip if an EventSource is already open
    if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
      return;
    }

    setLoading(true);
    setQrCode(null);

    // Start SSE stream for QR
    const eventSource = new EventSource("/api/whatsapp/qr", { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      if (!event.data) return;

      try {
        const parsed = JSON.parse(event.data) as QREvent;

        if (parsed.type === "qr") {
          setStatus("awaiting_qr");
          setQrCode(parsed.data);
          setLoading(false);
        } else if (parsed.type === "connected") {
          setStatus("connected");
          setQrCode(null);
          setLoading(false);
          eventSource.close();
          eventSourceRef.current = null;
        } else if (parsed.type === "disconnected") {
          setStatus("disconnected");
          setQrCode(null);
          setLoading(false);
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setLoading(false);
      eventSource.close();
      eventSourceRef.current = null;
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  const disconnect = useCallback(async () => {
    setLoading(true);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    await api.whatsapp.disconnect();
    setStatus("disconnected");
    setQrCode(null);
    setLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    status,
    qrCode,
    loading,
    connect,
    disconnect,
    refresh: fetchStatus
  };
}
