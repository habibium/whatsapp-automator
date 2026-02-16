import { create } from "zustand";
import { buildApiUrl, type WhatsAppStatus, whatsappApi } from "../lib/api";

type QREvent =
  | { type: "qr"; data: string }
  | { type: "connected" }
  | { type: "disconnected"; reason?: string };

interface WhatsAppState {
  status: WhatsAppStatus;
  qrCode: string | null;
  loading: boolean;
  eventSource: EventSource | null;
  fetchStatus: () => Promise<void>;
  connect: () => void;
  disconnect: () => Promise<void>;
  cleanup: () => void;
}

export const useWhatsAppStore = create<WhatsAppState>()((set, get) => ({
  status: "disconnected",
  qrCode: null,
  loading: true,
  eventSource: null,

  fetchStatus: async () => {
    try {
      const data = await whatsappApi.status();
      set({ status: data.status, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  connect: () => {
    const { eventSource: existing } = get();
    if (existing && existing.readyState !== EventSource.CLOSED) return;

    set({ loading: true, qrCode: null });

    const eventSource = new EventSource(buildApiUrl("/whatsapp/qr"), {
      withCredentials: true
    });

    set({ eventSource });

    eventSource.onmessage = (event) => {
      if (!event.data) return;
      try {
        const parsed = JSON.parse(event.data) as QREvent;
        if (parsed.type === "qr") {
          set({ status: "awaiting_qr", qrCode: parsed.data, loading: false });
        } else if (parsed.type === "connected") {
          set({ status: "connected", qrCode: null, loading: false });
          eventSource.close();
          set({ eventSource: null });
        } else if (parsed.type === "disconnected") {
          set({ status: "disconnected", qrCode: null, loading: false });
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      set({ loading: false });
      eventSource.close();
      set({ eventSource: null });
    };
  },

  disconnect: async () => {
    set({ loading: true });
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null });
    }
    try {
      await whatsappApi.disconnect();
    } finally {
      set({ status: "disconnected", qrCode: null, loading: false });
    }
  },

  cleanup: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null });
    }
  }
}));
