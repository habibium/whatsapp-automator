export type User = {
  id: string;
  email: string;
  createdAt: Date;
};

export type Session = {
  id: string;
  userId: string;
  expiresAt: Date;
};

export type WhatsAppConnectionStatus = "connected" | "disconnected" | "connecting" | "awaiting_qr";

export type WhatsAppConnection = {
  id: string;
  userId: string;
  status: WhatsAppConnectionStatus;
  updatedAt: Date;
};

export type ScheduledMessage = {
  id: string;
  userId: string;
  target: string;
  isGroup: boolean;
  message: string;
  scheduleType: "once" | "recurring";
  cronExpression: string | null;
  scheduledAt: Date | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateScheduledMessage = Omit<
  ScheduledMessage,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
export type UpdateScheduledMessage = Partial<CreateScheduledMessage>;

export type ApiResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

export type AuthStatus = {
  authenticated: boolean;
  user: User | null;
};

export type QRCodeEvent =
  | {
      type: "qr";
      data: string;
    }
  | {
      type: "connected";
    }
  | {
      type: "disconnected";
      reason?: string;
    };
