import { create } from "zustand";
import { api, type ScheduledMessage } from "../lib/api";

interface MessagesState {
  messages: ScheduledMessage[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  create: (
    data: Omit<ScheduledMessage, "id" | "userId" | "createdAt" | "updatedAt">
  ) => Promise<string | null>;
  update: (id: string, data: Partial<ScheduledMessage>) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
  toggleEnabled: (id: string, enabled: boolean) => Promise<string | null>;
}

export const useMessagesStore = create<MessagesState>()((set, get) => ({
  messages: [],
  loading: true,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const result = await api.messages.list();
    if (result.success) {
      set({ messages: result.data, loading: false });
    } else {
      set({ error: result.error, loading: false });
    }
  },

  create: async (data) => {
    const result = await api.messages.create(data);
    if (result.success) {
      set((state) => ({ messages: [result.data, ...state.messages] }));
      return null;
    }
    return result.error;
  },

  update: async (id, data) => {
    const result = await api.messages.update(id, data);
    if (result.success) {
      set((state) => ({
        messages: state.messages.map((m) => (m.id === id ? result.data : m))
      }));
      return null;
    }
    return result.error;
  },

  remove: async (id) => {
    const result = await api.messages.delete(id);
    if (result.success) {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== id)
      }));
      return null;
    }
    return result.error;
  },

  toggleEnabled: async (id, enabled) => {
    return get().update(id, { enabled });
  }
}));
