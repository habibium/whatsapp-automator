// Use env variable if set, otherwise use relative URL (works with Vite proxy in dev)
const API_BASE = import.meta.env["VITE_API_URL"] || "/api";

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  return response.json() as Promise<ApiResponse<T>>;
}

export type User = {
  id: string;
  email: string;
  createdAt: string;
};

export type ScheduledMessage = {
  id: string;
  userId: string;
  target: string;
  isGroup: boolean;
  message: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppStatus = "connected" | "disconnected" | "connecting" | "awaiting_qr";

export type WhatsAppGroup = {
  id: string;
  name: string;
};

// Auth API
export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
      }),

    login: (email: string, password: string) =>
      request<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      }),

    logout: () => request<null>("/auth/logout", { method: "POST" }),

    me: () => request<User>("/auth/me")
  },

  whatsapp: {
    status: () => request<{ status: WhatsAppStatus }>("/whatsapp/status"),

    connect: () => request<{ status: WhatsAppStatus }>("/whatsapp/connect", { method: "POST" }),

    disconnect: () =>
      request<{ status: WhatsAppStatus }>("/whatsapp/disconnect", { method: "POST" }),

    groups: () => request<WhatsAppGroup[]>("/whatsapp/groups")
  },

  messages: {
    list: () => request<ScheduledMessage[]>("/messages"),

    get: (id: string) => request<ScheduledMessage>(`/messages/${id}`),

    create: (data: Omit<ScheduledMessage, "id" | "userId" | "createdAt" | "updatedAt">) =>
      request<ScheduledMessage>("/messages", {
        method: "POST",
        body: JSON.stringify(data)
      }),

    update: (id: string, data: Partial<ScheduledMessage>) =>
      request<ScheduledMessage>(`/messages/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),

    delete: (id: string) => request<null>(`/messages/${id}`, { method: "DELETE" })
  }
};
