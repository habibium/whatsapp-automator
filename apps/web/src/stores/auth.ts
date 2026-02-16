import { create } from "zustand";
import { authApi, getErrorMessage, type User } from "../lib/api";

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
    try {
      const user = await authApi.me();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  refresh: async () => {
    try {
      const user = await authApi.me();
      set({ user });
    } catch {
      set({ user: null });
    }
  },

  login: async (email, password) => {
    try {
      const user = await authApi.login(email, password);
      set({ user });
      return null;
    } catch (error) {
      return getErrorMessage(error);
    }
  },

  register: async (email, password) => {
    try {
      const user = await authApi.register(email, password);
      set({ user });
      return null;
    } catch (error) {
      return getErrorMessage(error);
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      set({ user: null });
    }
  }
}));
