import { create } from "zustand";
import { authClient } from "../lib/auth-client";

export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
};

interface AuthState {
  user: User | null;
  loading: boolean;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    try {
      const { data } = await authClient.getSession();
      set({ user: data?.user ?? null, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  refresh: async () => {
    try {
      const { data } = await authClient.getSession();
      set({ user: data?.user ?? null });
    } catch {
      set({ user: null });
    }
  },

  logout: async () => {
    try {
      await authClient.signOut();
    } finally {
      set({ user: null });
    }
  }
}));
