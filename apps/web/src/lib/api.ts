import { apiClient } from "./api-client";

// Re-export for convenience
export { ApiError, buildApiUrl, getErrorMessage } from "./api-client";

// ── Types ──────────────────────────────────────────────────────────

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

export type CreateMessageInput = Omit<
  ScheduledMessage,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
export type UpdateMessageInput = Partial<CreateMessageInput>;

export type WhatsAppStatus = "connected" | "disconnected" | "connecting" | "awaiting_qr";

export type WhatsAppGroup = {
  id: string;
  name: string;
};

// ── Auth API ───────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<User>("/auth/login", { email, password }).then((r) => r.data),

  register: (email: string, password: string) =>
    apiClient.post<User>("/auth/register", { email, password }).then((r) => r.data),

  logout: () => apiClient.post("/auth/logout").then((r) => r.data),

  me: () => apiClient.get<User>("/auth/me").then((r) => r.data)
};

// ── WhatsApp API ───────────────────────────────────────────────────

export const whatsappApi = {
  status: () => apiClient.get<{ status: WhatsAppStatus }>("/whatsapp/status").then((r) => r.data),

  connect: () =>
    apiClient.post<{ status: WhatsAppStatus }>("/whatsapp/connect").then((r) => r.data),

  disconnect: () =>
    apiClient.post<{ status: WhatsAppStatus }>("/whatsapp/disconnect").then((r) => r.data),

  groups: () => apiClient.get<WhatsAppGroup[]>("/whatsapp/groups").then((r) => r.data)
};

// ── Server Info API ─────────────────────────────────────────────────

export type ServerTimezone = {
  timezone: string;
  offset: string;
};

export const serverApi = {
  timezone: () => apiClient.get<ServerTimezone>("/timezone").then((r) => r.data)
};

// ── Messages API ───────────────────────────────────────────────────

export const messagesApi = {
  list: () => apiClient.get<ScheduledMessage[]>("/messages").then((r) => r.data),

  get: (id: string) => apiClient.get<ScheduledMessage>(`/messages/${id}`).then((r) => r.data),

  create: (data: CreateMessageInput) =>
    apiClient.post<ScheduledMessage>("/messages", data).then((r) => r.data),

  update: (id: string, data: UpdateMessageInput) =>
    apiClient.put<ScheduledMessage>(`/messages/${id}`, data).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/messages/${id}`).then((r) => r.data)
};
