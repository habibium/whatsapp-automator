import { create } from "zustand";
import { api, type User } from "../lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    const result = await api.auth.me();
    set({
      user: result.success ? result.data : null,
      loading: false
    });
  },

  refresh: async () => {
    const result = await api.auth.me();
    set({ user: result.success ? result.data : null });
  },

  login: async (email, password) => {
    const result = await api.auth.login(email, password);
    if (result.success) {
      set({ user: result.data });
      return null;
    }
    return result.error;
  },

  register: async (email, password) => {
    const result = await api.auth.register(email, password);
    if (result.success) {
      set({ user: result.data });
      return null;
    }
    return result.error;
  },

  logout: async () => {
    await api.auth.logout();
    set({ user: null });
  }
}));
