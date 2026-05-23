import type { ConnectionStatus, RecipientType } from "@pkg/shared";
import {
  type ConnectionState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  type WASocket,
  type WAVersion
} from "baileys";
import { pino } from "pino";
import qrcode from "qrcode";
import {
  clearWhatsappSession,
  listPairedSessionUserIds,
  upsertWhatsappSession
} from "../db/repositories/whatsapp";
import { logger } from "../logger";
import { createAuthState } from "./auth-state";

const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_RECONNECT_DELAY_MS = 30_000;

type UserConnection = {
  socket: WASocket | null;
  status: ConnectionStatus;
  qr: string | null;
  phoneNumber: string | null;
  connecting: boolean;
  intentionalClose: boolean;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
};

export type WhatsAppStatus = {
  status: ConnectionStatus;
  qr: string | null;
  phoneNumber: string | null;
};

export type WhatsAppGroup = { id: string; name: string };

/** Converts a recipient (phone number or group JID) into a WhatsApp JID. */
export function resolveRecipientJid(type: RecipientType, recipient: string): string {
  if (type === "group") return recipient;
  return `${recipient.replace(/\D/g, "")}@s.whatsapp.net`;
}

function extractPhoneNumber(jid: string | undefined): string | null {
  const digits = jid?.split("@")[0]?.split(":")[0];
  return digits ? `+${digits}` : null;
}

/**
 * Owns every user's WhatsApp connection for the lifetime of the process.
 * Connections are opened on boot ({@link connectAll}) so scheduled messages
 * send without a browser tab open.
 */
class WhatsAppService {
  private readonly connections = new Map<string, UserConnection>();
  private readonly baileysLogger = pino({ level: "silent" });
  private version: WAVersion | undefined;

  private getOrCreate(userId: string): UserConnection {
    let connection = this.connections.get(userId);
    if (!connection) {
      connection = {
        socket: null,
        status: "disconnected",
        qr: null,
        phoneNumber: null,
        connecting: false,
        intentionalClose: false,
        reconnectAttempts: 0,
        reconnectTimer: null
      };
      this.connections.set(userId, connection);
    }
    return connection;
  }

  private async resolveVersion(): Promise<WAVersion | undefined> {
    if (!this.version) {
      try {
        this.version = (await fetchLatestBaileysVersion()).version;
      } catch (err) {
        logger.warn({ err }, "Could not fetch WhatsApp version — using Baileys default");
      }
    }
    return this.version;
  }

  getStatus(userId: string): WhatsAppStatus {
    const connection = this.connections.get(userId);
    return {
      status: connection?.status ?? "disconnected",
      qr: connection?.qr ?? null,
      phoneNumber: connection?.phoneNumber ?? null
    };
  }

  /** Opens a connection for a user. No-op if one is already active or in flight. */
  async connect(userId: string): Promise<void> {
    const connection = this.getOrCreate(userId);
    if (connection.socket || connection.connecting) return;

    connection.connecting = true;
    connection.intentionalClose = false;
    connection.status = "connecting";
    try {
      await upsertWhatsappSession(userId, { status: "connecting" });
      const { state, saveCreds } = await createAuthState(userId);
      const version = await this.resolveVersion();

      const socket = makeWASocket({
        ...(version ? { version } : {}),
        auth: state,
        logger: this.baileysLogger,
        browser: ["WA Scheduler", "Chrome", "1.0.0"],
        markOnlineOnConnect: false
      });
      connection.socket = socket;

      socket.ev.on("creds.update", saveCreds);
      socket.ev.on("connection.update", (update) => {
        void this.handleConnectionUpdate(userId, update);
      });
    } finally {
      connection.connecting = false;
    }
  }

  private async handleConnectionUpdate(
    userId: string,
    update: Partial<ConnectionState>
  ): Promise<void> {
    const connection = this.getOrCreate(userId);
    try {
      const { connection: state, lastDisconnect, qr } = update;

      if (qr) {
        connection.status = "qr";
        connection.qr = await qrcode.toDataURL(qr, { width: 280, margin: 2 });
        await upsertWhatsappSession(userId, { status: "qr" });
      }

      if (state === "open") {
        connection.status = "connected";
        connection.qr = null;
        connection.reconnectAttempts = 0;
        connection.phoneNumber = extractPhoneNumber(connection.socket?.user?.id);
        logger.info({ userId, phoneNumber: connection.phoneNumber }, "WhatsApp connected");
        await upsertWhatsappSession(userId, {
          status: "connected",
          phoneNumber: connection.phoneNumber
        });
      }

      if (state === "close") {
        connection.socket = null;
        connection.qr = null;
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
          ?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          logger.info({ userId }, "WhatsApp logged out — clearing stored session");
          await clearWhatsappSession(userId);
          connection.status = "disconnected";
          connection.phoneNumber = null;
        } else if (connection.intentionalClose) {
          connection.status = "disconnected";
          await upsertWhatsappSession(userId, { status: "disconnected" });
        } else {
          connection.status = "connecting";
          await upsertWhatsappSession(userId, { status: "connecting" });
          this.scheduleReconnect(userId);
        }
      }
    } catch (err) {
      logger.error({ userId, err }, "Error handling WhatsApp connection update");
    }
  }

  private scheduleReconnect(userId: string): void {
    const connection = this.getOrCreate(userId);
    if (connection.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn({ userId }, "WhatsApp reconnect attempts exhausted — giving up");
      connection.status = "disconnected";
      void upsertWhatsappSession(userId, { status: "disconnected" });
      return;
    }
    connection.reconnectAttempts += 1;
    const delay =
      Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * 2 ** connection.reconnectAttempts) +
      Math.floor(Math.random() * 1_000);
    logger.info(
      { userId, attempt: connection.reconnectAttempts, delay },
      "Scheduling WhatsApp reconnect"
    );
    connection.reconnectTimer = setTimeout(() => {
      connection.reconnectTimer = null;
      void this.connect(userId);
    }, delay);
  }

  private clearReconnect(connection: UserConnection): void {
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
      connection.reconnectTimer = null;
    }
  }

  /** Closes a connection but keeps credentials, so it can be reconnected later. */
  async disconnect(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (!connection) return;
    connection.intentionalClose = true;
    this.clearReconnect(connection);
    try {
      connection.socket?.end(undefined);
    } catch {
      // socket may already be closed
    }
    connection.socket = null;
    connection.status = "disconnected";
    connection.qr = null;
    await upsertWhatsappSession(userId, { status: "disconnected" });
  }

  /** Unlinks the device and wipes stored credentials. */
  async logout(userId: string): Promise<void> {
    const connection = this.getOrCreate(userId);
    connection.intentionalClose = true;
    this.clearReconnect(connection);
    try {
      await connection.socket?.logout();
    } catch (err) {
      logger.warn({ userId, err }, "Error sending WhatsApp logout");
    }
    try {
      connection.socket?.end(undefined);
    } catch {
      // socket may already be closed
    }
    connection.socket = null;
    connection.status = "disconnected";
    connection.qr = null;
    connection.phoneNumber = null;
    await clearWhatsappSession(userId);
  }

  /** Sends a text message. Throws if the user's WhatsApp is not connected. */
  async sendMessage(userId: string, jid: string, text: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (!connection?.socket || connection.status !== "connected") {
      throw new Error("WhatsApp is not connected");
    }
    await connection.socket.sendMessage(jid, { text });
  }

  /** Lists the WhatsApp groups the user participates in. */
  async listGroups(userId: string): Promise<WhatsAppGroup[]> {
    const connection = this.connections.get(userId);
    if (!connection?.socket || connection.status !== "connected") return [];
    const groups = await connection.socket.groupFetchAllParticipating();
    return Object.values(groups)
      .map((group) => ({ id: group.id, name: group.subject }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Reconnects every previously-paired session — called once on boot. */
  async connectAll(): Promise<void> {
    const userIds = await listPairedSessionUserIds();
    logger.info({ count: userIds.length }, "Reconnecting paired WhatsApp sessions");
    for (const userId of userIds) {
      try {
        await this.connect(userId);
      } catch (err) {
        logger.error({ userId, err }, "Failed to reconnect WhatsApp session");
      }
    }
  }

  /** Closes all sockets — called during graceful shutdown. */
  async shutdown(): Promise<void> {
    for (const [userId, connection] of this.connections) {
      this.clearReconnect(connection);
      try {
        connection.socket?.end(undefined);
      } catch {
        // socket may already be closed
      }
      logger.debug({ userId }, "Closed WhatsApp socket");
    }
    this.connections.clear();
  }
}

export const whatsappService = new WhatsAppService();
export type { WhatsAppService };
