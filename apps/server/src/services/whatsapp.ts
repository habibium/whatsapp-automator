import type { Boom } from "@hapi/boom";
import { logger } from "@pkg/shared";
import {
  type AuthenticationCreds,
  type AuthenticationState,
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  makeWASocket,
  proto,
  type SignalDataSet,
  type SignalDataTypeMap,
  type WASocket
} from "baileys";
import pino from "pino";
import {
  clearWhatsAppAuthState,
  getWhatsAppConnection,
  updateWhatsAppStatus,
  upsertWhatsAppConnection
} from "../db/queries.js";

type ConnectionEventHandler = {
  onQR: (qr: string) => void;
  onConnecting: () => void;
  onConnected: () => void;
  onDisconnected: (reason?: string) => void;
};

type UserConnection = {
  socket: WASocket | null;
  status: "disconnected" | "connecting" | "awaiting_qr" | "connected";
  lastQR: string | null;
  eventHandlers: Set<ConnectionEventHandler>;
  intentionalDisconnect: boolean;
  /** When true, the connection.update handler should skip all processing — logout() handles cleanup */
  loggingOut: boolean;
};

class WhatsAppService {
  private connections: Map<string, UserConnection> = new Map();

  private getOrCreateConnection(userId: string): UserConnection {
    let conn = this.connections.get(userId);
    if (!conn) {
      conn = {
        socket: null,
        status: "disconnected",
        lastQR: null,
        eventHandlers: new Set(),
        intentionalDisconnect: false,
        loggingOut: false
      };
      this.connections.set(userId, conn);
    }
    return conn;
  }

  addEventHandler(userId: string, handler: ConnectionEventHandler): () => void {
    const conn = this.getOrCreateConnection(userId);
    conn.eventHandlers.add(handler);

    // Replay current state to the new handler
    if (conn.status === "awaiting_qr" && conn.lastQR) {
      handler.onQR(conn.lastQR);
    } else if (conn.status === "connecting") {
      handler.onConnecting();
    } else if (conn.status === "connected") {
      handler.onConnected();
    }

    return () => conn.eventHandlers.delete(handler);
  }

  getStatus(userId: string): "disconnected" | "connecting" | "awaiting_qr" | "connected" {
    return this.connections.get(userId)?.status ?? "disconnected";
  }

  async connect(userId: string): Promise<void> {
    const conn = this.getOrCreateConnection(userId);

    if (conn.status === "connected" || conn.status === "awaiting_qr") {
      logger.debug({ userId }, "Already connected or awaiting QR");
      return;
    }

    conn.status = "connecting";
    conn.intentionalDisconnect = false;
    await updateWhatsAppStatus(userId, "connecting");

    const { state, saveCreds } = await this.createAuthState(userId);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }) // Silence Baileys internal logs
    });

    conn.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      // Skip processing if logout() is handling cleanup
      if (conn.loggingOut) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        conn.status = "awaiting_qr";
        conn.lastQR = qr;
        await updateWhatsAppStatus(userId, "awaiting_qr");
        for (const handler of conn.eventHandlers) {
          handler.onQR(qr);
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const wasIntentional = conn.intentionalDisconnect;
        const reason = (lastDisconnect?.error as Error)?.message ?? "Unknown";

        conn.socket = null;
        conn.lastQR = null;

        // If logged out from phone, clear stale auth state so fresh QR is generated next time
        if (isLoggedOut) {
          logger.info({ userId }, "WhatsApp logged out — clearing auth state for re-pairing");
          await clearWhatsAppAuthState(userId);
        }

        const willAutoReconnect = !wasIntentional && !isLoggedOut;

        if (willAutoReconnect) {
          // Show "connecting" state instead of "disconnected" during auto-reconnect
          conn.status = "connecting";
          await updateWhatsAppStatus(userId, "connecting");
          for (const handler of conn.eventHandlers) {
            handler.onConnecting();
          }
          logger.info({ userId }, "Reconnecting after unexpected disconnect");
          setTimeout(() => this.connect(userId), 3000);
        } else {
          conn.status = "disconnected";
          await updateWhatsAppStatus(userId, "disconnected");
          for (const handler of conn.eventHandlers) {
            handler.onDisconnected(reason);
          }
        }
      } else if (connection === "open") {
        conn.status = "connected";
        conn.lastQR = null;
        await updateWhatsAppStatus(userId, "connected");
        logger.info({ userId }, "WhatsApp connected");

        for (const handler of conn.eventHandlers) {
          handler.onConnected();
        }
      }
    });
  }

  async disconnect(userId: string): Promise<void> {
    const conn = this.connections.get(userId);
    if (conn) {
      conn.intentionalDisconnect = true;
      if (conn.socket) {
        try {
          conn.socket.end(undefined);
        } catch (error) {
          logger.debug({ userId, error }, "Error during socket.end (ignored)");
        }
        conn.socket = null;
      }
      conn.status = "disconnected";
      conn.lastQR = null;
      await updateWhatsAppStatus(userId, "disconnected");

      for (const handler of conn.eventHandlers) {
        handler.onDisconnected("User disconnected");
      }
    }
  }

  async logout(userId: string): Promise<void> {
    const conn = this.getOrCreateConnection(userId);
    conn.intentionalDisconnect = true;
    conn.loggingOut = true;

    let socket = conn.socket;

    // If there's no active socket, create a temporary one using the saved auth
    // state so we can send the logout/unlink request to WhatsApp's servers.
    if (!socket) {
      try {
        const { state, saveCreds } = await this.createAuthState(userId);
        const { version } = await fetchLatestBaileysVersion();

        socket = makeWASocket({
          version,
          auth: state,
          logger: pino({ level: "silent" })
        });

        socket.ev.on("creds.update", saveCreds);

        // Wait for the connection to open (or fail) before issuing logout
        const connected = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 15000);
          socket!.ev.on("connection.update", (update) => {
            if (update.connection === "open") {
              clearTimeout(timeout);
              resolve(true);
            } else if (update.connection === "close") {
              clearTimeout(timeout);
              resolve(false);
            }
          });
        });

        if (!connected) {
          logger.warn({ userId }, "Temporary socket failed to connect for logout");
          try {
            socket.end(undefined);
          } catch {
            /* ignore */
          }
          socket = null;
        }
      } catch (error) {
        logger.warn({ userId, error }, "Failed to create temporary socket for logout");
        socket = null;
      }
    }

    // Issue the actual logout request to WhatsApp to unlink the device
    if (socket) {
      try {
        await socket.logout();
        logger.info({ userId }, "WhatsApp logout request sent successfully");
      } catch (error) {
        logger.warn({ userId, error }, "Error during socket.logout");
        // Even if logout() throws, try to end the socket gracefully
        try {
          socket.end(undefined);
        } catch {
          /* ignore */
        }
      }
    } else {
      logger.warn(
        { userId },
        "No socket available for WhatsApp logout — only clearing local state"
      );
    }

    conn.socket = null;
    conn.status = "disconnected";
    conn.lastQR = null;
    conn.loggingOut = false;
    await clearWhatsAppAuthState(userId);
    await updateWhatsAppStatus(userId, "disconnected");

    for (const handler of conn.eventHandlers) {
      handler.onDisconnected("Logged out");
    }
  }

  async sendMessage(userId: string, chatId: string, message: string): Promise<boolean> {
    const conn = this.connections.get(userId);
    if (!conn?.socket || conn.status !== "connected") {
      logger.warn({ userId }, "Cannot send message: not connected");
      return false;
    }

    try {
      await conn.socket.sendMessage(chatId, { text: message });
      logger.info({ userId, chatId }, "Message sent successfully");
      return true;
    } catch (error) {
      logger.error({ userId, chatId, error }, "Failed to send message");
      return false;
    }
  }

  async getGroups(userId: string): Promise<Array<{ id: string; name: string }>> {
    const conn = this.connections.get(userId);
    if (!conn?.socket || conn.status !== "connected") {
      return [];
    }

    try {
      const groups = await conn.socket.groupFetchAllParticipating();
      return Object.entries(groups).map(([id, group]) => ({
        id,
        name: group.subject
      }));
    } catch (error) {
      logger.error({ userId, error }, "Failed to fetch groups");
      return [];
    }
  }

  async findChat(userId: string, target: string, isGroup: boolean): Promise<string | null> {
    if (isGroup) {
      const groups = await this.getGroups(userId);
      const group = groups.find((g) => g.name.toLowerCase() === target.toLowerCase());
      return group?.id ?? null;
    }
    // For contacts, format as WhatsApp ID
    const cleanNumber = target.replace(/[\s\-+]/g, "");
    return `${cleanNumber}@s.whatsapp.net`;
  }

  getPhoneNumber(userId: string): string | null {
    const conn = this.connections.get(userId);
    if (!conn?.socket) return null;
    try {
      const jid = conn.socket.user?.id;
      if (!jid) return null;
      // JID format: 1234567890:12@s.whatsapp.net — extract the number
      const num = jid.split("@")[0]?.split(":")[0];
      return num ? `+${num}` : null;
    } catch {
      return null;
    }
  }

  private async createAuthState(userId: string): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    // Load existing auth state from database
    const existing = await getWhatsAppConnection(userId);
    let authData: { creds: AuthenticationCreds; keys: Record<string, Record<string, unknown>> } = {
      creds: initAuthCreds(),
      keys: {}
    };

    if (existing?.authState) {
      try {
        authData = JSON.parse(JSON.stringify(existing.authState), BufferJSON.reviver);
      } catch {
        authData = { creds: initAuthCreds(), keys: {} };
      }
    }

    const saveCreds = async (): Promise<void> => {
      const serialized = JSON.parse(JSON.stringify(authData, BufferJSON.replacer));
      await upsertWhatsAppConnection(userId, serialized, this.getStatus(userId));
    };

    return {
      state: {
        creds: authData.creds,
        keys: {
          get: async <T extends keyof SignalDataTypeMap>(
            type: T,
            ids: string[]
          ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
            const data: { [id: string]: SignalDataTypeMap[T] } = {};
            for (const id of ids) {
              const storedValue = authData.keys[type]?.[id];
              if (storedValue === undefined) continue;

              let value = storedValue;
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(
                  value as Record<string, unknown>
                );
              }
              data[id] = value as SignalDataTypeMap[T];
            }
            return data;
          },
          set: async (data: SignalDataSet): Promise<void> => {
            for (const category in data) {
              const categoryKey = category as keyof SignalDataSet;
              const categoryData = data[categoryKey];
              if (!categoryData) continue;

              if (!authData.keys[categoryKey]) {
                authData.keys[categoryKey] = {};
              }

              for (const id in categoryData) {
                const value = categoryData[id];
                if (value !== null && value !== undefined) {
                  authData.keys[categoryKey][id] = value;
                } else {
                  delete authData.keys[categoryKey][id];
                }
              }
            }
            await saveCreds();
          }
        }
      },
      saveCreds
    };
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down WhatsApp service");
    for (const [userId, conn] of this.connections) {
      if (conn.socket) {
        conn.socket.end(undefined);
      }
      logger.debug({ userId }, "Disconnected user");
    }
    this.connections.clear();
  }
}

export const whatsappService = new WhatsAppService();
