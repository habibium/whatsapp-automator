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
  /** Track intentional disconnects to prevent auto-reconnect in SSE handler */
  _intentionalClose: boolean;
  fetchStatus: () => Promise<void>;
  connect: () => void;
  disconnect: () => Promise<void>;
  logout: () => Promise<void>;
  cleanup: () => void;
}

export const useWhatsAppStore = create<WhatsAppState>()((set, get) => ({
  status: "disconnected",
  qrCode: null,
  loading: true,
  eventSource: null,
  _intentionalClose: false,

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

    set({ loading: true, qrCode: null, _intentionalClose: false });

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
          // Don't close SSE — keep listening for unexpected disconnects
        } else if (parsed.type === "disconnected") {
          const { _intentionalClose } = get();
          set({ status: "disconnected", qrCode: null, loading: false });
          // If this was an intentional disconnect, close the SSE and stop
          if (_intentionalClose) {
            eventSource.close();
            set({ eventSource: null });
          }
          // Otherwise let the server-side auto-reconnect handle it —
          // the SSE stream will send a new QR or connected event
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      const { _intentionalClose } = get();
      set({ loading: false });
      eventSource.close();
      set({ eventSource: null });
      // If not intentional, attempt to reconnect SSE after a delay
      if (!_intentionalClose) {
        setTimeout(() => {
          const state = get();
          // Only reconnect if we haven't intentionally closed
          if (!state._intentionalClose && !state.eventSource) {
            state.connect();
          }
        }, 5000);
      }
    };
  },

  disconnect: async () => {
    set({ loading: true, _intentionalClose: true });
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

  logout: async () => {
    set({ loading: true, _intentionalClose: true });
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null });
    }
    try {
      await whatsappApi.logout();
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
