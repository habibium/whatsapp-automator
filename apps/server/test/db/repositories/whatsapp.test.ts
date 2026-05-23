import { beforeEach, describe, expect, it } from "vitest";
import {
  clearWhatsappSession,
  deleteSignalKeys,
  getSignalKeys,
  getWhatsappSession,
  listPairedSessionUserIds,
  saveSignalKeys,
  upsertWhatsappSession
} from "../../../src/db/repositories/whatsapp";
import { resetDb, seedTestUser, TEST_USER } from "../../helpers/db";

beforeEach(async () => {
  await resetDb();
  await seedTestUser();
});

describe("whatsapp session repository", () => {
  it("upserts new rows then updates them in place", async () => {
    await upsertWhatsappSession(TEST_USER.id, { status: "connecting" });
    let session = await getWhatsappSession(TEST_USER.id);
    expect(session?.status).toBe("connecting");

    await upsertWhatsappSession(TEST_USER.id, {
      status: "connected",
      phoneNumber: "+15555550100",
      creds: "encrypted-blob"
    });
    session = await getWhatsappSession(TEST_USER.id);
    expect(session?.status).toBe("connected");
    expect(session?.phoneNumber).toBe("+15555550100");
    expect(session?.creds).toBe("encrypted-blob");
  });

  it("listPairedSessionUserIds includes only users with creds", async () => {
    await upsertWhatsappSession(TEST_USER.id, { status: "connecting" });
    expect(await listPairedSessionUserIds()).toEqual([]);

    await upsertWhatsappSession(TEST_USER.id, { creds: "blob" });
    expect(await listPairedSessionUserIds()).toEqual([TEST_USER.id]);
  });

  it("clearWhatsappSession wipes creds and signal keys", async () => {
    await upsertWhatsappSession(TEST_USER.id, { creds: "blob", status: "connected" });
    await saveSignalKeys(TEST_USER.id, "pre-key", [{ keyId: "1", data: "a" }]);

    await clearWhatsappSession(TEST_USER.id);

    const session = await getWhatsappSession(TEST_USER.id);
    expect(session?.creds).toBeNull();
    expect(session?.status).toBe("disconnected");
    expect(await getSignalKeys(TEST_USER.id, "pre-key", ["1"])).toEqual(new Map());
  });
});

describe("whatsapp signal key repository", () => {
  it("batch upserts keys and reads them back", async () => {
    await saveSignalKeys(TEST_USER.id, "session", [
      { keyId: "a", data: "alpha" },
      { keyId: "b", data: "beta" }
    ]);

    const map = await getSignalKeys(TEST_USER.id, "session", ["a", "b", "missing"]);
    expect(map.get("a")).toBe("alpha");
    expect(map.get("b")).toBe("beta");
    expect(map.has("missing")).toBe(false);
  });

  it("overwrites existing key values on conflict", async () => {
    await saveSignalKeys(TEST_USER.id, "session", [{ keyId: "a", data: "v1" }]);
    await saveSignalKeys(TEST_USER.id, "session", [{ keyId: "a", data: "v2" }]);
    const map = await getSignalKeys(TEST_USER.id, "session", ["a"]);
    expect(map.get("a")).toBe("v2");
  });

  it("deletes targeted keys only", async () => {
    await saveSignalKeys(TEST_USER.id, "pre-key", [
      { keyId: "1", data: "a" },
      { keyId: "2", data: "b" },
      { keyId: "3", data: "c" }
    ]);
    await deleteSignalKeys(TEST_USER.id, "pre-key", ["1", "3"]);
    const remaining = await getSignalKeys(TEST_USER.id, "pre-key", ["1", "2", "3"]);
    expect([...remaining.keys()]).toEqual(["2"]);
  });

  it("returns an empty map when no ids are requested", async () => {
    expect(await getSignalKeys(TEST_USER.id, "any", [])).toEqual(new Map());
  });
});
