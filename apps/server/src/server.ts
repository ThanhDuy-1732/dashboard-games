import { availableParallelism } from "node:os";
import { readDeployments } from "./deployments.js";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TelemetryEvent } from "@nha-choi/protocol";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import type { z } from "zod";
import {
  createRoomSchema,
  joinRoomSchema,
  readySchema,
  leaveRoomSchema,
  emptyRoomSchema,
  resumeRoomSchema,
} from "@nha-choi/protocol";
import type { RoomReply, CommandReply } from "@nha-choi/protocol";
import type { RandomSource } from "@nha-choi/game-core";
import { CaroRooms } from "./caro-rooms.js";
import { Rooms } from "./rooms.js";
import { RoomStoreError } from "./database.js";
import type { RoomStore } from "./database.js";
import type { MetricWriter } from "./metrics.js";
import { ingestTelemetry } from "./telemetry-http.js";
import { createAdminHandler, createCleanupHandler } from "./admin.js";
import type { AdminOptions } from "./admin.js";
import { json } from "./http.js";
import { serverRandom } from "./random.js";
interface Options {
  port?: number;
  host?: string;
  origins?: string[];
  now?: () => number;
  random?: RandomSource;
  store?: RoomStore;
  metrics?: MetricWriter;
  admin?: AdminOptions;
  revision?: string;
  telemetryPeerLimit?: number;
  allowWriterHandoff?: boolean;
}
export async function createGameServer({
  port = 3001,
  host = "127.0.0.1",
  origins = ["http://127.0.0.1:5173", "http://localhost:5173"],
  now = Date.now,
  random = serverRandom,
  store,
  metrics,
  admin,
  revision,
  telemetryPeerLimit = 30,
  allowWriterHandoff = false,
}: Options = {}) {
  let healthy = true,
    closing = false;
  let startup: "ready" | "waiting" | "failed" = "ready";
  const cleanup = createCleanupHandler(metrics);
  const adminHandler = admin && createAdminHandler(admin, async (req, res, url, session) => {
    if (await cleanup(req, res, url, session)) return;
    if (req.method === "GET" && url.pathname === "/api/admin/deployments") {
      const deployments = await readDeployments(process.env);
      return json(res, 200, {
        ...deployments,
        backend: {
          sha: revision && /^[a-f0-9]{40}$/.test(revision) ? revision : undefined,
          branch: process.env.RENDER_GIT_BRANCH,
          nodeVersion: process.version,
          cpu: availableParallelism(),
          uptimeSeconds: Math.floor(process.uptime()),
        },
      });
    }
    if (req.method !== "GET" || !["/api/admin/summary", "/api/admin/system"].includes(url.pathname))
      return json(res, 404, { error: "NOT_FOUND" });
    if (!metrics?.summary) return json(res, 503, { error: "METRICS_UNAVAILABLE" });
    const range = url.searchParams.get("range") ?? "7d";
    const days = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 0;
    if (!days) return json(res, 400, { error: "RANGE" });
    const summary = await metrics.summary(days, true);
    json(res, 200, { ...summary, ongoing: { caro: caro.activeGames, "ty-phu": rooms.activeGames }, droppedMetrics, metricWriteErrors });
  });
  const http = createServer((req, res) => {
    if (req.url === "/health") {
      if (revision && /^[a-f0-9]{40}$/.test(revision)) res.setHeader("X-App-Revision", revision);
      const ok = startup === "ready" && healthy && !closing;
      // Render sends SIGTERM to the old process only after routing to this one.
      const waiting = startup === "waiting" && !closing;
      return json(res, ok || waiting ? 200 : 503, waiting
        ? { ok: false, status: "WAITING_FOR_WRITER" }
        : { ok });
    }
    if (startup !== "ready") return json(res, 503, { error: "STORAGE_UNAVAILABLE" });
    if (req.url?.startsWith("/api/admin/") && adminHandler) {
      void adminHandler(req, res, new URL(req.url, "http://localhost"))
        .catch(() => { if (!res.headersSent) json(res, 503, { error: "ADMIN_UNAVAILABLE" }); });
      return;
    }
    if (req.url === "/api/telemetry") {
      void ingestTelemetry(req, res, origins, () =>
        consume(`telemetry:${req.socket.remoteAddress}`, telemetryPeerLimit, 60000), metrics,
      ).catch(() => { if (!res.headersSent) json(res, 400, { error: "REQUEST" }); });
      return;
    }
    json(res, 404, { error: "NOT_FOUND" });
  });
  const io = new Server(http, {
    maxHttpBufferSize: 32768,
    cors: { origin: origins, methods: ["GET", "POST"] },
    allowRequest(req, callback) {
      const origin = req.headers.origin;
      callback(null, startup === "ready" && !closing && (origin === undefined || origins.includes(origin)));
    },
  });
  io.use((socket, next) => {
    const auth = socket.handshake.auth;
    if (
      (auth.protocolVersion !== undefined && auth.protocolVersion !== 1) ||
      (auth.rulesVersion !== undefined && auth.rulesVersion !== "classic-v1")
    ) {
      next(new Error("PROTOCOL_MISMATCH"));
      return;
    }
    next();
  });
  const rooms = new Rooms(io, random, now);
  const serverEvents: TelemetryEvent[] = [];
  let droppedMetrics = 0, metricWriteErrors = 0;
  let writingMetrics: Promise<void> | undefined;
  function addMetric(event: TelemetryEvent) {
    if (!metrics) return;
    if (serverEvents.length >= 1000) {
      droppedMetrics++;
      return;
    }
    serverEvents.push(event);
  }
  function latency(metric: "backend" | "database", start: number, technicalError: boolean) {
    if (!metrics) return;
    addMetric({ id: randomUUID(), occurredAt: new Date(now()).toISOString(), kind: "latency",
      metric, durationMs: Math.min(120_000, performance.now() - start), technicalError });
  }
  function flushMetrics() {
    if (!metrics || writingMetrics || !serverEvents.length) return writingMetrics;
    const batch = serverEvents.slice(0, 50);
    writingMetrics = metrics.record("server", batch)
      .then((receipt) => {
        droppedMetrics += receipt.expired.length;
        serverEvents.splice(0, batch.length);
      }, () => { metricWriteErrors++; })
      .finally(() => { writingMetrics = undefined; });
    return writingMetrics;
  }
  const caro = new CaroRooms(io, now, metrics ? addMetric : undefined);
  if (store) {
    try {
      rooms.restore(await store.load());
    } catch (error) {
      if (!allowWriterHandoff || !writerInUse(error)) {
        await store.close().catch(() => {});
        io.close();
        throw error;
      }
      startup = "waiting";
      console.info("Đang chờ backend cũ nhả quyền ghi.");
    }
  }
  const stopHandoff = new AbortController();
  async function acquireWriter(store: RoomStore) {
    const deadline = performance.now() + 150_000;
    while (!closing && performance.now() < deadline) {
      await delay(2_000, undefined, { signal: stopHandoff.signal }).catch(() => {});
      if (closing) return;
      try {
        rooms.restore(await store.load());
        startup = "ready";
        console.info("Đã nhận quyền ghi và khôi phục phòng online.");
        return;
      } catch (error) {
        if (!writerInUse(error)) break;
      }
    }
    if (closing) return;
    startup = "failed";
    console.error("Không nhận được quyền ghi để mở phòng online.");
  }
  let queue: Promise<void> = Promise.resolve(),
    pending = 0;
  const disconnected = new Set<string>();
  async function mutate<T>(work: () => T, track = false): Promise<T> {
    if (!store) return work();
    if (pending >= 256) throw new Error("Room queue is full");
    pending++;
    const result = queue.then(async () => {
      if (!healthy || store.needsReload()) {
        rooms.restore(await store.load(), "recover");
        healthy = true;
        rooms.publishAll();
      }
      const dropped = [...disconnected];
      const value = await rooms.durable(
        () => {
          for (const id of dropped) rooms.disconnect(id);
          return work();
        },
        async (records, events) => {
          const start = performance.now();
          try {
            const elapsed = await store.save(records, events);
            if (track && typeof elapsed === "number") latency("database", performance.now() - elapsed, false);
          } catch (error) {
            if (track) latency("database", start, true);
            throw error;
          }
        },
      );
      for (const id of dropped) disconnected.delete(id);
      return value;
    });
    queue = result.then(
      () => {},
      () => {},
    );
    try {
      return await result;
    } catch (error) {
      healthy = false;
      rooms.storageUnavailable();
      throw error;
    } finally {
      pending--;
    }
  }

  const limits = new Map<string, { count: number; start: number }>();
  function consume(key: string, max: number, window: number) {
    let value = limits.get(key);
    if (!value || now() - value.start >= window) {
      value = { count: 0, start: now() };
      limits.set(key, value);
    }
    value.count++;
    return value.count <= max;
  }
  io.on("connection", (socket) => {
    caro.attach(socket, consume);
    function roomRequest<T>(
      event: string,
      schema: z.ZodType<T>,
      handler: (value: T) => RoomReply,
      joining = false,
    ) {
      socket.on(event, (payload: unknown, ack: unknown) => {
        if (typeof ack !== "function") return;
        if (closing) {
          ack({ ok: false, code: "SERVER_CLOSING" });
          return;
        }
        if (
          !consume(
            joining
              ? `join:${socket.handshake.address}`
              : `room:${rooms.sessionKey(socket.id)}`,
            joining ? 30 : 20,
            joining ? 60000 : 1000,
          )
        ) {
          ack({ ok: false, code: "RATE_LIMITED" });
          return;
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          ack({ ok: false, code: "INVALID_INPUT" });
          return;
        }
        void mutate(() => handler(parsed.data))
          .then((value) => ack(value))
          .catch(() =>
            ack({
              ok: false,
              code: store ? "STORAGE_UNAVAILABLE" : "SERVER_ERROR",
            }),
          );
      });
    }
    roomRequest(
      "room:create",
      createRoomSchema,
      (input) => rooms.create(socket.id, input),
      true,
    );
    roomRequest(
      "room:join",
      joinRoomSchema,
      (input) => rooms.join(socket.id, input),
      true,
    );
    roomRequest(
      "room:resume",
      resumeRoomSchema,
      (input) => rooms.resume(socket.id, input.resumeToken),
      true,
    );
    roomRequest("room:ready", readySchema, (input) =>
      rooms.ready(socket.id, input.ready),
    );
    roomRequest("room:start", emptyRoomSchema, () => rooms.start(socket.id));
    roomRequest("room:leave", leaveRoomSchema, (input) =>
      rooms.leave(socket.id, input.discard),
    );
    roomRequest("game:end-interrupted", emptyRoomSchema, () =>
      rooms.endInterrupted(socket.id),
    );
    socket.on("game:command", (payload: unknown, ack: unknown) => {
      if (typeof ack !== "function") return;
      if (closing) {
        ack({
          ok: false,
          commandId: "invalid",
          revision: rooms.currentRevision(socket.id),
          code: "PAUSED",
        });
        return;
      }
      if (!consume(`game:${rooms.sessionKey(socket.id)}`, 20, 1000)) {
        const raw = payload as { commandId?: unknown } | null;
        const reply: CommandReply = {
          ok: false,
          commandId:
            typeof raw?.commandId === "string" ? raw.commandId : "invalid",
          revision: rooms.currentRevision(socket.id),
          code: "RATE_LIMITED",
        };
        ack(reply);
        return;
      }
      const start = performance.now();
      void mutate(() => rooms.command(socket.id, payload), true)
        .then((value) => {
          latency("backend", start, false);
          ack(value);
        })
        .catch(() => {
          latency("backend", start, true);
          const raw = payload as { commandId?: unknown } | null;
          const reply: CommandReply = {
            ok: false,
            commandId:
              typeof raw?.commandId === "string" ? raw.commandId : "invalid",
            revision: rooms.currentRevision(socket.id),
            code: store ? "STORAGE_UNAVAILABLE" : "INVALID_GAME",
          };
          ack(reply);
        });
    });
    socket.on("disconnect", () => {
      if (closing) return;
      if (!store) {
        rooms.disconnect(socket.id);
        return;
      }
      disconnected.add(socket.id);
      void mutate(() => {}).catch(() => {});
    });
  });
  const interval = setInterval(() => {
    for (const [key, value] of limits)
      if (now() - value.start > 60000) limits.delete(key);
    if (startup !== "ready") return;
    if (!closing) {
      caro.sweep();
      void flushMetrics();
    }
    if (closing || pending || (store && healthy && rooms.size === 0)) return;
    void mutate(() => rooms.sweep()).catch(() => {});
  }, 1000);
  interval.unref();
  try {
    await new Promise<void>((resolve, reject) => {
      http.once("error", reject);
      http.listen(port, host, () => {
        http.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    clearInterval(interval);
    io.close();
    await store?.close().catch(() => {});
    throw error;
  }
  const handoff = store && startup === "waiting" ? acquireWriter(store) : undefined;
  const address = http.address() as AddressInfo;
  let closePromise: Promise<void> | null = null;
  return {
    url: `http://${host}:${address.port}`,
    rooms,
    beginDrain: async () => {
      if (startup !== "ready") return;
      caro.closeAll();
      return mutate(() => rooms.closeAll());
    },
    close: () => {
      if (closePromise) return closePromise;
      closing = true;
      stopHandoff.abort();
      clearInterval(interval);
      caro.closeAll();
      closePromise = (async () => {
        await handoff;
        await queue;
        if (store && startup === "ready") {
          try {
            await mutate(() => rooms.pauseForRestart());
          } catch {
            healthy = false;
          }
        } else rooms.closeAll();
        await new Promise<void>((resolve) => io.close(() => resolve()));
        await writingMetrics;
        while (serverEvents.length) {
          const pending = serverEvents.length;
          await flushMetrics();
          if (serverEvents.length === pending) break;
        }
        await store?.close();
      })();
      return closePromise;
    },
  };
}

function writerInUse(error: unknown) {
  return error instanceof RoomStoreError && error.code === "BACKEND_ALREADY_RUNNING";
}
