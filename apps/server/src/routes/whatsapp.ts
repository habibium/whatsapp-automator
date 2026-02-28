import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import qrcode from "qrcode";
import { type AuthContext, authMiddleware } from "../middleware/auth.js";
import { whatsappService } from "../services/whatsapp.js";

export const whatsappRoutes = new Hono<AuthContext>();

// All routes require authentication
whatsappRoutes.use("/*", authMiddleware);

// Get connection status
whatsappRoutes.get("/status", (c) => {
  const user = c.get("user");
  const status = whatsappService.getStatus(user.id);
  return c.json({ success: true, data: { status } });
});

// Stream QR code via SSE
whatsappRoutes.get("/qr", async (c) => {
  const user = c.get("user");

  return streamSSE(c, async (stream) => {
    let closed = false;

    const cleanup = whatsappService.addEventHandler(user.id, {
      onQR: async (qr) => {
        if (closed) return;
        const qrDataUrl = await qrcode.toDataURL(qr, { width: 256 });
        await stream.writeSSE({
          data: JSON.stringify({ type: "qr", data: qrDataUrl }),
          event: "message"
        });
      },
      onConnecting: async () => {
        if (closed) return;
        await stream.writeSSE({
          data: JSON.stringify({ type: "connecting" }),
          event: "message"
        });
      },
      onConnected: async () => {
        if (closed) return;
        await stream.writeSSE({ data: JSON.stringify({ type: "connected" }), event: "message" });
      },
      onDisconnected: async (reason) => {
        if (closed) return;
        await stream.writeSSE({
          data: JSON.stringify({ type: "disconnected", reason }),
          event: "message"
        });
      }
    });

    // Start connection if not already connected/connecting
    // (addEventHandler already replays current state to new handlers)
    const status = whatsappService.getStatus(user.id);
    if (status === "disconnected") {
      await whatsappService.connect(user.id);
    }

    // Keep connection alive
    const keepAlive = setInterval(async () => {
      if (closed) return;
      try {
        await stream.writeSSE({ data: "", event: "ping" });
      } catch {
        closed = true;
      }
    }, 30000);

    // Wait for abort
    c.req.raw.signal.addEventListener("abort", () => {
      closed = true;
      clearInterval(keepAlive);
      cleanup();
    });

    // Block until closed
    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener("abort", () => resolve());
    });
  });
});

// Connect WhatsApp
whatsappRoutes.post("/connect", async (c) => {
  const user = c.get("user");
  await whatsappService.connect(user.id);
  return c.json({ success: true, data: { status: whatsappService.getStatus(user.id) } });
});

// Disconnect WhatsApp
whatsappRoutes.post("/disconnect", async (c) => {
  const user = c.get("user");
  await whatsappService.disconnect(user.id);
  return c.json({ success: true, data: { status: "disconnected" } });
});

// Logout WhatsApp (clears auth state for re-pairing)
whatsappRoutes.post("/logout", async (c) => {
  const user = c.get("user");
  await whatsappService.logout(user.id);
  return c.json({ success: true, data: { status: "disconnected" } });
});

// Get available groups
whatsappRoutes.get("/groups", async (c) => {
  const user = c.get("user");
  const groups = await whatsappService.getGroups(user.id);
  return c.json({ success: true, data: groups });
});
