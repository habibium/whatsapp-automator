import { networkInterfaces } from "node:os";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user as userTable } from "../db/schema.js";
import { whatsappService } from "./whatsapp.js";

/**
 * Supported template variables:
 * - {{local_IP}}     - Server's local network IP address
 * - {{port}}         - Server port
 * - {{server_date}}  - Current date on the server
 * - {{server_time}}  - Current time on the server
 * - {{username}}     - Email of the user who scheduled the message
 * - {{phone}}        - Phone number of the user's WhatsApp connection
 */

function getLocalIP(): string {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === "IPv4" && !info.internal) {
        return info.address;
      }
    }
  }
  return "127.0.0.1";
}

function getServerDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getServerTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

export async function processTemplate(template: string, userId: string): Promise<string> {
  // Quick check: if no template markers exist, return as-is
  if (!template.includes("{{")) {
    return template;
  }

  const user = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .then((r) => r[0]);
  const phone = whatsappService.getPhoneNumber(userId);
  const port = process.env["PORT"] || "3000";

  const variables: Record<string, string> = {
    "{{local_IP}}": getLocalIP(),
    "{{port}}": port,
    "{{server_date}}": getServerDate(),
    "{{server_time}}": getServerTime(),
    "{{username}}": user?.email ?? "unknown",
    "{{phone}}": phone ?? "unknown"
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(key, value);
  }

  return result;
}
