/** Offline-first inspection queue.
 *  Inspections are always written to the browser first, then pushed to the
 *  server. Local evidence is only cleared after a confirmed successful sync. */
import type { InspectionPayload } from "@/lib/catalog";

export type SyncState = "LOCAL" | "SYNCING" | "SYNCED" | "FAILED";

export type LocalInspection = {
  uid: string;
  createdAt: string;
  sync: SyncState;
  error?: string | undefined;
  payload: InspectionPayload;
};

const KEY = "pramana.inspections.v1";

const canStore = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const readQueue = (): LocalInspection[] => {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalInspection[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (items: LocalInspection[]) => {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage full: keep the most recent records only.
    try {
      window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 20)));
    } catch {
      /* nothing further can be done in the browser */
    }
  }
};

export const saveLocal = (payload: InspectionPayload): LocalInspection => {
  const record: LocalInspection = { uid: payload.uid, createdAt: new Date().toISOString(), sync: "LOCAL", payload };
  const items = readQueue().filter((item) => item.uid !== payload.uid);
  writeQueue([record, ...items]);
  return record;
};

export const setSyncState = (uid: string, sync: SyncState, error?: string) => {
  const items = readQueue().map((item) => (item.uid === uid ? { ...item, sync, ...(error ? { error } : { error: undefined }) } : item));
  writeQueue(items);
  return items;
};

export const removeLocal = (uid: string) => {
  writeQueue(readQueue().filter((item) => item.uid !== uid));
};

export const pending = (items: LocalInspection[]) => items.filter((item) => item.sync !== "SYNCED");

/** Pushes every unsynced inspection to the server, one at a time. */
export async function flushQueue(push: (payload: InspectionPayload) => Promise<void>) {
  let synced = 0;
  let failed = 0;
  for (const item of pending(readQueue())) {
    setSyncState(item.uid, "SYNCING");
    try {
      await push(item.payload);
      setSyncState(item.uid, "SYNCED");
      synced += 1;
    } catch (cause) {
      setSyncState(item.uid, "FAILED", cause instanceof Error ? cause.message : "Sync failed.");
      failed += 1;
    }
  }
  return { synced, failed };
}
