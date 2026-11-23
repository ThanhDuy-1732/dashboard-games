import { createHash, randomInt, randomUUID } from "node:crypto";
import { CARO_SIZE, createCaro, playCaro } from "@nha-choi/game-core";
import type { CaroGame, CaroMark } from "@nha-choi/game-core";
import { gameDurationMs, resumeTokenSchema } from "@nha-choi/protocol";
import type { CaroRoomReply, CaroRoomView, TelemetryEvent } from "@nha-choi/protocol";
import type { Server, Socket } from "socket.io";
import { z } from "zod";

interface Seat {
  name: string;
  mark: CaroMark;
  socketId: string | null;
  readyForRematch: boolean;
}
interface Room {
  id: string;
  code: string;
  seats: Map<string, Seat>;
  game: CaroGame;
  round: number;
  revision: number;
  updatedAt: number;
  startedAt?: number;
}
const name = z.string().trim().min(1).max(24);
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/);
const enterSchema = z.strictObject({
  name,
  code: code.optional(),
  resumeToken: resumeTokenSchema,
});
const moveSchema = z.strictObject({
  index: z
    .number()
    .int()
    .min(0)
    .max(CARO_SIZE ** 2 - 1),
  revision: z.number().int().nonnegative(),
});
const roundSchema = z.strictObject({ round: z.number().int().positive() });
const resumeSchema = z.strictObject({ resumeToken: resumeTokenSchema });
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tokenKey = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export class CaroRooms {
  private rooms = new Map<string, Room>();
  private byToken = new Map<string, Room>();
  private bySocket = new Map<string, { room: Room; seat: Seat }>();
  private draining = false;

  constructor(
    private io: Server,
    private now: () => number,
    private record?: (event: TelemetryEvent) => void,
  ) {}

  get activeGames() {
    return [...this.rooms.values()].filter(({ game }) => game.moves.length > 0 && !game.result).length;
  }

  private milestone(room: Room, kind: "game_started" | "game_completed") {
    const now = this.now();
    if (kind === "game_started") room.startedAt = now;
    const durationMs = kind === "game_completed" ? gameDurationMs(room.startedAt, now) : undefined;
    this.record?.({
      id: `${room.id}:${room.round}:${kind}`, occurredAt: new Date(now).toISOString(),
      kind, game: "caro", mode: "online", ...(durationMs === undefined ? {} : { durationMs }),
    });
  }

  attach(
    socket: Socket,
    consume: (key: string, max: number, window: number) => boolean,
  ) {
    const request = <T>(
      event: string,
      schema: z.ZodType<T>,
      handle: (input: T) => CaroRoomReply,
      entering = false,
    ) => {
      socket.on(event, (input: unknown, ack: unknown) => {
        if (typeof ack !== "function") return;
        if (this.draining) {
          ack({ ok: false, code: "BUSY" });
          return;
        }
        const key = entering
          ? `caro-entry:${socket.handshake.address}`
          : `caro-play:${socket.id}`;
        if (!consume(key, entering ? 60 : 20, entering ? 60000 : 1000)) {
          ack({ ok: false, code: "RATE_LIMITED" });
          return;
        }
        const start = performance.now();
        const parsed = schema.safeParse(input);
        const value = parsed.success ? handle(parsed.data) : { ok: false, code: "INVALID_INPUT" };
        if (parsed.success && event === "caro:move")
          this.record?.({ id: randomUUID(), occurredAt: new Date(this.now()).toISOString(),
            kind: "latency", metric: "backend", durationMs: Math.min(120_000, performance.now() - start), technicalError: false });
        ack(value);
      });
    };
    request(
      "caro:enter",
      enterSchema,
      (input) => this.enter(socket, input),
      true,
    );
    request(
      "caro:resume",
      resumeSchema,
      (input) => this.resume(socket, tokenKey(input.resumeToken)),
      true,
    );
    request("caro:move", moveSchema, ({ index, revision }) =>
      this.act(
        socket.id,
        (room) => room.revision === revision,
        (room, seat) => {
          if (seat.mark !== room.game.turn) return false;
          const game = playCaro(room.game, index);
          if (!game) return false;
          room.game = game;
          if (game.moves.length === 1) this.milestone(room, "game_started");
          if (game.result) this.milestone(room, "game_completed");
          return true;
        },
      ),
    );
    request("caro:rematch", roundSchema, ({ round }) =>
      this.act(
        socket.id,
        (room) => room.round === round,
        (room, seat) => {
          if (!room.game.result || seat.readyForRematch) return false;
          seat.readyForRematch = true;
          if (
            [...room.seats.values()].every((player) => player.readyForRematch)
          ) {
            for (const player of room.seats.values()) {
              player.mark = player.mark === "X" ? "O" : "X";
              player.readyForRematch = false;
            }
            room.game = createCaro();
            room.round++;
          }
          return true;
        },
      ),
    );
    socket.on("disconnect", () => this.disconnect(socket.id));
  }

  private enter(
    socket: Socket,
    input: z.infer<typeof enterSchema>,
  ): CaroRoomReply {
    const key = tokenKey(input.resumeToken);
    if (this.byToken.has(key)) return this.resume(socket, key);
    if (this.bySocket.has(socket.id)) return { ok: false, code: "BUSY" };
    let room: Room;
    if (input.code) {
      const existing = this.rooms.get(input.code);
      if (!existing) return { ok: false, code: "INVALID_ROOM" };
      if (existing.seats.size === 2) return { ok: false, code: "ROOM_FULL" };
      room = existing;
    } else {
      if (this.rooms.size >= 500) return { ok: false, code: "BUSY" };
      let roomCode: string;
      do {
        roomCode = Array.from(
          { length: 6 },
          () => alphabet[randomInt(alphabet.length)],
        ).join("");
      } while (this.rooms.has(roomCode));
      room = {
        id: randomUUID(),
        code: roomCode,
        seats: new Map(),
        game: createCaro(),
        round: 1,
        revision: 0,
        updatedAt: this.now(),
      };
      this.rooms.set(roomCode, room);
    }
    room.seats.set(key, {
      name: input.name,
      mark: room.seats.size ? "O" : "X",
      socketId: null,
      readyForRematch: false,
    });
    this.byToken.set(key, room);
    return this.resume(socket, key);
  }

  private resume(socket: Socket, key: string): CaroRoomReply {
    const room = this.byToken.get(key);
    const seat = room?.seats.get(key);
    if (!room || !seat) return { ok: false, code: "INVALID_ROOM" };
    const bound = this.bySocket.get(socket.id);
    if (bound && bound.seat !== seat) return { ok: false, code: "BUSY" };
    if (seat.socketId && seat.socketId !== socket.id) {
      const prior = seat.socketId;
      this.bySocket.delete(prior);
      this.io.sockets.sockets
        .get(prior)
        ?.emit("caro:closed", "Phiên Caro đã được mở ở kết nối khác.");
    }
    seat.socketId = socket.id;
    this.bySocket.set(socket.id, { room, seat });
    this.publish(room);
    return this.reply(room, seat);
  }

  private act(
    id: string,
    current: (room: Room) => boolean,
    apply: (room: Room, seat: Seat) => boolean,
  ): CaroRoomReply {
    const binding = this.bySocket.get(id);
    if (!binding) return { ok: false, code: "NOT_AUTHORIZED" };
    const { room, seat } = binding;
    if (
      room.seats.size !== 2 ||
      [...room.seats.values()].some((player) => !player.socketId)
    )
      return { ok: false, code: "WAITING" };
    if (!current(room)) return { ok: false, code: "STALE_REVISION" };
    if (!apply(room, seat)) return { ok: false, code: "INVALID_MOVE" };
    this.publish(room);
    return this.reply(room, seat);
  }

  private view(room: Room): CaroRoomView {
    return {
      code: room.code,
      game: room.game,
      round: room.round,
      revision: room.revision,
      players: [...room.seats.values()].map(
        ({ name, mark, socketId, readyForRematch }) => ({
          name,
          mark,
          connected: Boolean(socketId),
          readyForRematch,
        }),
      ),
    };
  }

  private reply(room: Room, seat: Seat): CaroRoomReply {
    return { ok: true, room: this.view(room), mark: seat.mark };
  }

  private publish(room: Room) {
    room.revision++;
    room.updatedAt = this.now();
    const view = this.view(room);
    for (const seat of room.seats.values()) {
      if (seat.socketId)
        this.io.to(seat.socketId).emit("caro:update", view, seat.mark);
    }
  }

  private disconnect(id: string) {
    const binding = this.bySocket.get(id);
    if (!binding) return;
    this.bySocket.delete(id);
    binding.seat.socketId = null;
    this.publish(binding.room);
  }

  sweep() {
    for (const room of this.rooms.values()) {
      const fullAndConnected =
        room.seats.size === 2 &&
        [...room.seats.values()].every((seat) => seat.socketId);
      const expiresAfter = (fullAndConnected ? 360 : 30) * 60_000;
      if (this.now() - room.updatedAt >= expiresAfter)
        this.closeRoom(room, "Phòng Caro đã hết hạn.");
    }
  }

  closeAll() {
    this.draining = true;
    for (const room of this.rooms.values())
      this.closeRoom(room, "Máy chủ đã đóng phòng Caro.");
  }

  private closeRoom(room: Room, message: string) {
    this.rooms.delete(room.code);
    for (const [key, seat] of room.seats) {
      this.byToken.delete(key);
      if (seat.socketId) {
        this.bySocket.delete(seat.socketId);
        this.io.to(seat.socketId).emit("caro:closed", message);
      }
    }
  }
}
