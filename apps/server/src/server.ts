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
import type { RoomStore } from "./database.js";
import { serverRandom } from "./random.js";
interface Options {
  port?: number;
  host?: string;
  origins?: string[];
  now?: () => number;
  random?: RandomSource;
  store?: RoomStore;
}
export async function createGameServer({
  port = 3001,
  host = "127.0.0.1",
  origins = ["http://127.0.0.1:5173", "http://localhost:5173"],
  now = Date.now,
  random = serverRandom,
  store,
}: Options = {}) {
  let healthy = true,
    closing = false;
  const http = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/health") {
      res.writeHead(healthy && !closing ? 200 : 503);
      res.end(JSON.stringify({ ok: healthy && !closing }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "NOT_FOUND" }));
    }
  });
  const io = new Server(http, {
    maxHttpBufferSize: 32768,
    cors: { origin: origins, methods: ["GET", "POST"] },
    allowRequest(req, callback) {
      const origin = req.headers.origin;
      callback(null, origin === undefined || origins.includes(origin));
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
  const caro = new CaroRooms(io, now);
  if (store) {
    try {
      rooms.restore(await store.load());
    } catch (error) {
      await store.close().catch(() => {});
      io.close();
      throw error;
    }
  }
  let queue: Promise<void> = Promise.resolve(),
    pending = 0;
  const disconnected = new Set<string>();
  async function mutate<T>(work: () => T): Promise<T> {
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
        (records) => store.save(records),
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
      void mutate(() => rooms.command(socket.id, payload))
        .then((value) => ack(value))
        .catch(() => {
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
    if (!closing) caro.sweep();
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
  const address = http.address() as AddressInfo;
  let closePromise: Promise<void> | null = null;
  return {
    url: `http://${host}:${address.port}`,
    rooms,
    beginDrain: () => {
      caro.closeAll();
      return mutate(() => rooms.closeAll());
    },
    close: () => {
      if (closePromise) return closePromise;
      closing = true;
      clearInterval(interval);
      caro.closeAll();
      closePromise = (async () => {
        await queue;
        if (store) {
          try {
            await mutate(() => rooms.pauseForRestart());
          } catch {
            healthy = false;
          }
        } else rooms.closeAll();
        await new Promise<void>((resolve) => io.close(() => resolve()));
        await store?.close();
      })();
      return closePromise;
    },
  };
}
