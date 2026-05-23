import {
  type AuthenticationCreds,
  type AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  type SignalDataSet,
  type SignalDataTypeMap
} from "baileys";
import {
  deleteSignalKeys,
  getSignalKeys,
  getWhatsappSession,
  saveSignalKeys,
  upsertWhatsappSession
} from "../db/repositories/whatsapp";
import { decrypt, encrypt } from "../lib/crypto";

export type AuthStateHandle = {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
};

/**
 * Builds a Baileys auth state persisted to the database.
 *
 * Credentials live in a single `whatsapp_session` row; Signal protocol keys
 * are stored one-row-per-key so updates touch only what changed. Every value
 * is encrypted at rest with AES-256-GCM.
 */
export async function createAuthState(userId: string): Promise<AuthStateHandle> {
  const existing = await getWhatsappSession(userId);
  const creds: AuthenticationCreds = existing?.creds
    ? (JSON.parse(decrypt(existing.creds), BufferJSON.reviver) as AuthenticationCreds)
    : initAuthCreds();

  const saveCreds = async (): Promise<void> => {
    const serialized = JSON.stringify(creds, BufferJSON.replacer);
    await upsertWhatsappSession(userId, { creds: encrypt(serialized) });
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const stored = await getSignalKeys(userId, type, ids);
        const result: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        for (const id of ids) {
          const raw = stored.get(id);
          if (raw === undefined) continue;
          let value = JSON.parse(decrypt(raw), BufferJSON.reviver);
          if (type === "app-state-sync-key" && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          result[id] = value;
        }
        return result;
      },
      set: async (data: SignalDataSet) => {
        for (const category of Object.keys(data) as (keyof SignalDataSet)[]) {
          const entries = data[category];
          if (!entries) continue;

          const toSave: { keyId: string; data: string }[] = [];
          const toDelete: string[] = [];
          for (const [id, value] of Object.entries(entries)) {
            if (value) {
              toSave.push({ keyId: id, data: encrypt(JSON.stringify(value, BufferJSON.replacer)) });
            } else {
              toDelete.push(id);
            }
          }
          await saveSignalKeys(userId, category, toSave);
          await deleteSignalKeys(userId, category, toDelete);
        }
      }
    }
  };

  return { state, saveCreds };
}
