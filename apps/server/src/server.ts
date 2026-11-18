import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import type { z } from "zod";
import {
  createRoomSchema,
  joinRoomSchema,
  readySchema,
  emptyRoomSchema,
  resumeRoomSchema,
} from "@nha-choi/protocol";
import type { RoomReply, CommandReply } from "@nha-choi/protocol";
import type { RandomSource } from "@nha-choi/game-core";
import { Rooms } from "./rooms.js";
import { serverRandom } from "./random.js";
interface Options {
  port?: number;
  host?: string;
  origins?: string[];
  now?: () => number;
  random?: RandomSource;
}
export async function createGameServer({
  port = 3001,
  host = "127.0.0.1",
  origins = ["http://127.0.0.1:5173", "http://localhost:5173"],
  now = Date.now,
  random = serverRandom,
}: Options = {}) {
  const http = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/health") {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
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
    function roomRequest<T>(
      event: string,
      schema: z.ZodType<T>,
      handler: (value: T) => RoomReply,
      joining = false,
    ) {
      socket.on(event, (payload: unknown, ack: unknown) => {
        if (typeof ack !== "function") return;
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
        try {
          ack(handler(parsed.data));
        } catch {
          ack({ ok: false, code: "SERVER_ERROR" });
        }
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
    roomRequest("room:leave", emptyRoomSchema, () => rooms.leave(socket.id));
    roomRequest("game:end-interrupted", emptyRoomSchema, () =>
      rooms.endInterrupted(socket.id),
    );
    socket.on("game:command", (payload: unknown, ack: unknown) => {
      if (typeof ack !== "function") return;
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
      try {
        ack(rooms.command(socket.id, payload));
      } catch {
        const reply: CommandReply = {
          ok: false,
          commandId: "invalid",
          revision: rooms.currentRevision(socket.id),
          code: "INVALID_GAME",
        };
        ack(reply);
      }
    });
    socket.on("disconnect", () => rooms.disconnect(socket.id));
  });
  const interval = setInterval(() => {
    rooms.sweep();
    for (const [key, value] of limits)
      if (now() - value.start > 60000) limits.delete(key);
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
    throw error;
  }
  const address = http.address() as AddressInfo;
  return {
    url: `http://${host}:${address.port}`,
    rooms,
    beginDrain: () => rooms.closeAll(),
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(interval);
        rooms.closeAll();
        io.close(() => resolve());
      }),
  };
}
