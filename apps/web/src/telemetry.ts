import type { TelemetryEvent } from "@nha-choi/protocol";
import { getPlatform, onlineServerUrl } from "./platform.js";

let opening: Promise<IDBDatabase> | undefined;
function database() {
  return opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("nha-choi-telemetry", 1);
    request.onupgradeneeded = () => {
      const events = request.result.createObjectStore("events", { keyPath: "id" });
      events.createIndex("byTime", "occurredAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    opening = undefined;
    throw error;
  });
}

function result<T>(operation: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}

function committed(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

export async function enqueueTelemetry(event: TelemetryEvent) {
  const db = await database();
  const tx = db.transaction("events", "readwrite");
  const completed = committed(tx);
  const store = tx.objectStore("events");
  store.put(event);
  const count = await result(store.count());
  if (count > 5000) {
    const oldest = await result(store.index("byTime").getAll()) as TelemetryEvent[];
    const removable = oldest.find(({ kind }) => kind !== "game_started" && kind !== "game_completed") ?? oldest[0];
    if (removable) store.delete(removable.id);
  }
  await completed;
}

export function track(event: TelemetryEvent) {
  void enqueueTelemetry(event).catch(() => {});
}

let sending: Promise<void> | undefined;
export function flushTelemetry() {
  if (sending) return sending;
  if (globalThis.navigator?.onLine === false) return Promise.resolve();
  const platform = getPlatform();
  const server = platform === "web" ? "" : onlineServerUrl();
  if (server === null) return Promise.resolve();
  const endpoint = server ? new URL("/api/telemetry", server).href : "/api/telemetry";
  sending = (async () => {
    const db = await database();
    for (let i = 0; i < 5; i++) {
      const events = await result(db.transaction("events").objectStore("events").index("byTime").getAll(null, 50)) as TelemetryEvent[];
      if (!events.length) return;
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }),
        credentials: "omit",
      });
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) return;
      const receipt: { accepted: string[]; expired: string[] } = await response.json();
      const acknowledged = new Set([...receipt.accepted, ...receipt.expired]);
      const confirmed = events.filter(({ id }) => acknowledged.has(id));
      if (!confirmed.length) return;
      const tx = db.transaction("events", "readwrite");
      const completed = committed(tx);
      for (const { id } of confirmed) tx.objectStore("events").delete(id);
      await completed;
    }
  })().catch(() => {}).finally(() => { sending = undefined; });
  return sending;
}

export function trackGame(game: "caro" | "ty-phu", id: string, kind: "game_started" | "game_completed") {
  track({ id: `${game}:${id}:${kind}`, kind, occurredAt: new Date().toISOString(), mode: "offline", game });
}

export function trackDeviceLatency(start: number, technicalError: boolean) {
  track({ id: crypto.randomUUID(), occurredAt: new Date().toISOString(), kind: "latency",
    metric: "device", durationMs: Math.min(120_000, performance.now() - start), technicalError });
}

type Screen = Extract<TelemetryEvent, { kind: "view" }>["screen"];
type TrafficSession = { id: string; last: number };
const sessionKey = "nha-choi-traffic-session";
let session: TrafficSession | undefined;
function getSession() {
  if (session) return session;
  try {
    const stored: TrafficSession | null = JSON.parse(sessionStorage.getItem(sessionKey) ?? "null");
    if (stored && typeof stored.id === "string" && /^[a-f0-9-]{36}$/.test(stored.id)
        && Number.isFinite(stored.last) && stored.last <= Date.now()) session = stored;
  } catch { /* The in-memory session still works. */ }
  return session;
}
function saveSession(value: TrafficSession) {
  session = value;
  try { sessionStorage.setItem(sessionKey, JSON.stringify(value)); } catch { /* Use memory. */ }
}
function trackPresence(kind: "view" | "activity", screen?: Screen, passive = false) {
  const time = Date.now();
  const native = getPlatform();
  const platform = native === "web" && window.matchMedia?.("(display-mode: standalone)").matches ? "pwa" as const : native;
  const occurredAt = new Date(time).toISOString();
  let current = getSession();
  if (!current || time - current.last >= 30 * 60_000) {
    if (passive) return;
    current = { id: crypto.randomUUID(), last: time };
    track({ id: current.id, sessionId: current.id, occurredAt, kind: "session_started", platform });
  }
  if (!passive) saveSession({ ...current, last: time });
  const base = { id: crypto.randomUUID(), sessionId: current.id, occurredAt, platform };
  if (kind === "view" && screen) track({ ...base, kind, screen });
  if (kind === "activity") track({ ...base, kind });
}

export function trackScreen(screen: Screen) {
  trackPresence("view", screen);
}

export function startTelemetry() {
  function flush() {
    if (document.visibilityState === "visible") void flushTelemetry();
  }
  function heartbeat() {
    if (document.visibilityState !== "visible" || !navigator.onLine) return;
    trackPresence("activity", undefined, true);
    flush();
  }
  function interaction() {
    if (session && Date.now() - session.last < 30 * 60_000) saveSession({ ...session, last: Date.now() });
    else trackPresence("activity");
  }
  const timer = window.setInterval(heartbeat, 60_000);
  window.addEventListener("online", heartbeat);
  document.addEventListener("visibilitychange", heartbeat);
  document.addEventListener("pointerdown", interaction);
  document.addEventListener("keydown", interaction);
  heartbeat();
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("online", heartbeat);
    document.removeEventListener("visibilitychange", heartbeat);
    document.removeEventListener("pointerdown", interaction);
    document.removeEventListener("keydown", interaction);
  };
}
