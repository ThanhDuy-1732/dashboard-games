import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { createGame } from "@nha-choi/game-core";
import type { BoardSize, RandomSource, Token } from "@nha-choi/game-core";
import { createAuthority, commandSchema } from "@nha-choi/protocol";
import type {
  GameAuthority,
  CreateRoomInput,
  JoinRoomInput,
  LobbyView,
  RoomReply,
  CommandReply,
  SessionUpdate,
} from "@nha-choi/protocol";
import { roomCheckpointSchema } from "./room-checkpoint.js";
import type { RoomCheckpoint } from "./room-checkpoint.js";
import type { Server } from "socket.io";
interface Member {
  id: string;
  name: string;
  token: Token;
  ready: boolean;
  discardOnLeave?: true;
  socketId: string | null;
  disconnectedAt: number | null;
  tokenHash: string;
}
interface Room {
  id: string;
  code: string;
  hostId: string;
  boardSize: BoardSize;
  members: Member[];
  authority: GameAuthority | null;
  lastActivity: number;
  closedAt: number | null;
  reason: string;
  publishedCanEnd: boolean;
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class Rooms {
  private pendingCheckpoint: RoomCheckpoint[] | null = null;
  private effects: (() => void)[] | null = null;
  private draining = false;
  private rooms = new Map<string, Room>();
  private codes = new Map<string, string>();
  private bindings = new Map<string, { roomId: string; playerId: string }>();
  private secrets = new Map<string, { roomId: string; playerId: string }>();
  constructor(
    private io: Server,
    private random: RandomSource,
    private now: () => number,
  ) {}
  get size() {
    return this.rooms.size;
  }
  private effect(work: () => void) {
    if (this.effects) this.effects.push(work);
    else work();
  }
  private supportsBoard(socketId: string, size: BoardSize) {
    if (size === 40) return true;
    const auth = this.io.sockets.sockets.get(socketId)?.handshake.auth;
    return size === 24 ? auth?.compactBoard === true : auth?.mediumBoard === true;
  }
  checkpoint(): RoomCheckpoint[] {
    return [...this.rooms.values()].map((room) => ({
      ...room,
      schemaVersion: 1,
      members: structuredClone(room.members),
      authority: room.authority?.checkpoint() ?? null,
    }));
  }
  restore(
    records: RoomCheckpoint[],
    mode: "rollback" | "restart" | "recover" = "restart",
  ) {
    const parsed = records.map((record) => roomCheckpointSchema.parse(record));
    if (
      new Set(parsed.map((room) => room.id)).size !== parsed.length ||
      new Set(parsed.map((room) => room.code)).size !== parsed.length ||
      new Set(
        parsed.flatMap((room) =>
          room.members.map((member) => member.tokenHash),
        ),
      ).size !== parsed.reduce((n, room) => n + room.members.length, 0)
    )
      throw new Error("Invalid room registry");
    const oldBindings = [...this.bindings.keys()];
    this.rooms.clear();
    this.codes.clear();
    this.bindings.clear();
    this.secrets.clear();
    for (const record of parsed) {
      const { authority, ...data } = record;
      if (mode !== "rollback") {
        let lostConnection = false;
        for (const member of data.members) {
          if (
            mode === "restart" ||
            (member.socketId &&
              !this.io.sockets.sockets.get(member.socketId)?.connected)
          ) {
            member.socketId = null;
            member.disconnectedAt = this.now();
            lostConnection = true;
          }
        }
        if (lostConnection) data.lastActivity = this.now();
        data.publishedCanEnd = false;
      }
      const room: Room = {
        ...data,
        authority: authority
          ? createAuthority(authority.state, this.random, authority.replies)
          : null,
      };
      this.rooms.set(room.id, room);
      this.codes.set(room.code, room.id);
      for (const member of room.members) {
        this.secrets.set(member.tokenHash, {
          roomId: room.id,
          playerId: member.id,
        });
        if (member.socketId)
          this.bindings.set(member.socketId, {
            roomId: room.id,
            playerId: member.id,
          });
      }
    }
    if (mode === "recover")
      for (const socketId of oldBindings)
        if (!this.bindings.has(socketId))
          this.effect(() =>
            this.io.sockets.sockets.get(socketId)?.disconnect(true),
          );
  }
  async durable<T>(
    work: () => T,
    save: (records: RoomCheckpoint[]) => Promise<void>,
  ): Promise<T> {
    const before = this.checkpoint();
    this.pendingCheckpoint = before;
    this.effects = [];
    let committed = false;
    try {
      const result = work();
      await save(this.checkpoint());
      committed = true;
      this.pendingCheckpoint = null;
      const effects = this.effects;
      this.effects = null;
      for (const effect of effects) effect();
      return result;
    } catch (error) {
      if (!committed) this.restore(before, "rollback");
      this.effects = null;
      throw error;
    } finally {
      this.pendingCheckpoint = null;
    }
  }
  publishAll() {
    for (const room of this.rooms.values()) {
      this.publish(room);
      if (!room.authority && room.closedAt === null)
        for (const member of room.members)
          if (member.socketId) {
            const socketId = member.socketId;
            this.effect(() =>
              this.io.to(socketId).emit("game:update", {
                connection: "connected",
                view: null,
              } satisfies SessionUpdate),
            );
          }
    }
  }
  storageUnavailable() {
    for (const room of this.rooms.values())
      for (const member of room.members)
        if (member.socketId)
          this.io.to(member.socketId).emit("game:update", {
            connection: "paused",
            view: room.authority?.getView(member.id) ?? null,
            reason:
              "Chưa lưu được ván vào máy chủ. Ván tạm dừng; hãy đợi kết nối lại.",
            canEndInterrupted: false,
          } satisfies SessionUpdate);
  }
  pauseForRestart() {
    this.draining = true;
    for (const socketId of [...this.bindings.keys()]) this.disconnect(socketId);
  }
  private view(room: Room): LobbyView {
    return {
      roomId: room.id,
      code: room.code,
      hostId: room.hostId,
      capacity: 6,
      boardSize: room.boardSize,
      started: room.authority !== null,
      closed: room.closedAt !== null,
      players: room.members.map((p) => ({
        id: p.id,
        name: p.name,
        token: p.token,
        ready: p.ready,
        connected: p.socketId !== null,
      })),
    };
  }
  private bound(socketId: string) {
    const binding = this.bindings.get(socketId);
    const room = binding ? this.rooms.get(binding.roomId) : undefined;
    const member = room?.members.find((p) => p.id === binding?.playerId);
    return room && member ? { room, member } : null;
  }
  private reply(room: Room, member: Member, resumeToken?: string): RoomReply {
    return {
      ok: true,
      room: this.view(room),
      selfId: member.id,
      ...(resumeToken ? { resumeToken } : {}),
    };
  }
  private bind(room: Room, member: Member, socketId: string) {
    const previous = member.socketId;
    member.socketId = socketId;
    member.disconnectedAt = null;
    delete member.discardOnLeave;
    room.lastActivity = this.now();
    this.bindings.set(socketId, { roomId: room.id, playerId: member.id });
    if (previous && previous !== socketId) {
      this.bindings.delete(previous);
      this.effect(() =>
        this.io.sockets.sockets.get(previous)?.disconnect(true),
      );
    }
  }
  private add(room: Room, socketId: string, input: CreateRoomInput): RoomReply {
    const secret = input.resumeToken ?? randomBytes(32).toString("base64url");
    const member: Member = {
      id: randomUUID(),
      name: input.name,
      token: input.token,
      ready: false,
      socketId: null,
      disconnectedAt: null,
      tokenHash: hash(secret),
    };
    room.members.push(member);
    this.secrets.set(member.tokenHash, {
      roomId: room.id,
      playerId: member.id,
    });
    if (!room.hostId) room.hostId = member.id;
    this.bind(room, member, socketId);
    this.publish(room);
    return this.reply(room, member, secret);
  }
  create(socketId: string, input: CreateRoomInput): RoomReply {
    if (this.draining) return { ok: false, code: "SERVER_CLOSING" };
    if (!this.supportsBoard(socketId, input.boardSize ?? 40))
      return { ok: false, code: "UNSUPPORTED_BOARD" };
    if (input.resumeToken && this.secrets.has(hash(input.resumeToken)))
      return this.resume(socketId, input.resumeToken);
    if (this.bindings.has(socketId)) return { ok: false, code: "INVALID_ROOM" };
    let code = "";
    do {
      code = Array.from(
        { length: 6 },
        () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[randomInt(36)],
      ).join("");
    } while (this.codes.has(code));
    const room: Room = {
      id: randomUUID(),
      code,
      hostId: "",
      boardSize: input.boardSize ?? 40,
      members: [],
      authority: null,
      lastActivity: this.now(),
      closedAt: null,
      reason: "",
      publishedCanEnd: false,
    };
    this.rooms.set(room.id, room);
    this.codes.set(code, room.id);
    return this.add(room, socketId, input);
  }
  join(socketId: string, input: JoinRoomInput): RoomReply {
    if (this.draining) return { ok: false, code: "SERVER_CLOSING" };
    const roomId = this.codes.get(input.code);
    const room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room || room.closedAt !== null)
      return { ok: false, code: "INVALID_ROOM" };
    if (!this.supportsBoard(socketId, room.boardSize))
      return { ok: false, code: "UNSUPPORTED_BOARD" };
    if (input.resumeToken) {
      const previous = this.secrets.get(hash(input.resumeToken));
      if (previous)
        return previous.roomId === room.id
          ? this.resume(socketId, input.resumeToken)
          : { ok: false, code: "INVALID_ROOM" };
    }
    if (this.bindings.has(socketId)) return { ok: false, code: "INVALID_ROOM" };
    if (room.closedAt !== null) return { ok: false, code: "INVALID_ROOM" };
    if (room.authority) return { ok: false, code: "GAME_STARTED" };
    if (room.members.length >= 6) return { ok: false, code: "ROOM_FULL" };
    if (room.members.some((p) => p.token === input.token))
      return { ok: false, code: "TOKEN_TAKEN" };
    return this.add(room, socketId, input);
  }
  resume(socketId: string, secret: string): RoomReply {
    const proof = this.secrets.get(hash(secret));
    const room = proof ? this.rooms.get(proof.roomId) : undefined;
    const member = room?.members.find((p) => p.id === proof?.playerId);
    if (!room || !member) return { ok: false, code: "INVALID_ROOM" };
    if (!this.supportsBoard(socketId, room.boardSize))
      return { ok: false, code: "UNSUPPORTED_BOARD" };
    const old = this.bound(socketId);
    if (old && (old.room.id !== room.id || old.member.id !== member.id))
      return { ok: false, code: "NOT_AUTHORIZED" };
    this.bind(room, member, socketId);
    this.publish(room);
    return this.reply(room, member, secret);
  }
  ready(socketId: string, ready: boolean): RoomReply {
    const target = this.bound(socketId);
    if (!target) return { ok: false, code: "NOT_AUTHORIZED" };
    const { room, member } = target;
    if (room.authority || room.closedAt !== null)
      return { ok: false, code: "GAME_STARTED" };
    member.ready = ready;
    room.lastActivity = this.now();
    this.publish(room);
    return this.reply(room, member);
  }
  start(socketId: string): RoomReply {
    const target = this.bound(socketId);
    if (!target) return { ok: false, code: "NOT_AUTHORIZED" };
    const { room, member } = target;
    if (member.id !== room.hostId) return { ok: false, code: "NOT_HOST" };
    if (room.closedAt !== null) return { ok: false, code: "INVALID_ROOM" };
    if (room.authority) return { ok: false, code: "GAME_STARTED" };
    if (
      room.members.length < 2 ||
      room.members.some((p) => !p.ready || !p.socketId)
    )
      return { ok: false, code: "NOT_READY" };
    room.authority = createAuthority(
      createGame(
        {
          gameId: room.id,
          boardSize: room.boardSize,
          players: room.members.map((p) => ({
            id: p.id,
            name: p.name,
            token: p.token,
            kind: "human",
          })),
        },
        this.random,
      ),
      this.random,
    );
    room.lastActivity = this.now();
    this.publish(room);
    return this.reply(room, member);
  }
  private missing(room: Room) {
    if (room.members.every((p) => p.socketId !== null)) return [];
    const state = room.authority?.snapshot();
    return room.members.filter(
      (p) =>
        !p.socketId &&
        state?.players.some((player) => player.id === p.id && !player.bankrupt),
    );
  }
  private canEnd(room: Room) {
    return (
      room.closedAt === null &&
      this.missing(room).some(
        (p) =>
          p.disconnectedAt !== null && this.now() - p.disconnectedAt >= 120000,
      )
    );
  }
  private publish(room: Room) {
    const lobby = this.view(room);
    const missing = this.missing(room);
    const canEnd = this.canEnd(room);
    room.publishedCanEnd = canEnd;
    for (const member of room.members) {
      if (!member.socketId) continue;
      const socketId = member.socketId;
      this.effect(() => this.io.to(socketId).emit("room:update", lobby));
      if (room.authority || room.closedAt !== null) {
        const update: SessionUpdate = {
          connection:
            room.closedAt !== null
              ? "closed"
              : missing.length
                ? "paused"
                : "connected",
          view: room.authority?.getView(member.id) ?? null,
          ...(room.closedAt !== null
            ? { reason: room.reason }
            : missing.length
              ? { reason: "Đang chờ người chơi kết nối lại." }
              : {}),
          canEndInterrupted: canEnd,
        };
        this.effect(() => this.io.to(socketId).emit("game:update", update));
      }
    }
  }
  command(socketId: string, payload: unknown): CommandReply {
    const target = this.bound(socketId);
    const raw = payload as {
      commandId?: unknown;
      protocolVersion?: unknown;
    } | null;
    const commandId =
      typeof raw?.commandId === "string" ? raw.commandId : "invalid";
    if (!target)
      return { ok: false, code: "NOT_AUTHORIZED", commandId, revision: 0 };
    const { room, member } = target;
    const revision = room.authority?.snapshot().revision ?? 0;
    if (raw?.protocolVersion !== 1)
      return { ok: false, code: "PROTOCOL_MISMATCH", commandId, revision };
    const parsed = commandSchema.safeParse(payload);
    if (!parsed.success)
      return { ok: false, code: "INVALID_ACTION", commandId, revision };
    const cached = room.authority?.cachedReply(member.id, parsed.data);
    if (cached) return cached;
    if (!room.authority || room.closedAt !== null || this.missing(room).length)
      return { ok: false, code: "PAUSED", commandId, revision };
    const reply = room.authority.dispatch(member.id, parsed.data);
    room.lastActivity = this.now();
    if (room.authority.snapshot().phase === "finished") {
      room.closedAt = this.now();
      room.reason = "Ván đấu đã kết thúc.";
    }
    this.publish(room);
    return reply;
  }
  currentRevision(socketId: string) {
    if (this.pendingCheckpoint)
      return (
        this.pendingCheckpoint.find((room) =>
          room.members.some((member) => member.socketId === socketId),
        )?.authority?.state.revision ?? 0
      );
    return this.bound(socketId)?.room.authority?.snapshot().revision ?? 0;
  }
  sessionKey(socketId: string) {
    const value = this.bound(socketId);
    return value ? `${value.room.id}:${value.member.id}` : socketId;
  }
  endInterrupted(socketId: string): RoomReply {
    const target = this.bound(socketId);
    if (!target) return { ok: false, code: "NOT_AUTHORIZED" };
    const { room, member } = target;
    if (
      !this.canEnd(room) ||
      room.authority?.snapshot().players.find((p) => p.id === member.id)
        ?.bankrupt
    )
      return { ok: false, code: "NOT_AUTHORIZED" };
    room.closedAt = this.now();
    room.reason =
      "Ván đã kết thúc do có người mất kết nối, không tính người thắng.";
    this.publish(room);
    return this.reply(room, member);
  }
  disconnect(socketId: string) {
    const target = this.bound(socketId);
    if (!target) return;
    const { room, member } = target;
    this.bindings.delete(socketId);
    member.socketId = null;
    member.disconnectedAt = this.now();
    room.lastActivity = this.now();
    this.publish(room);
  }
  leave(socketId: string, discard = false): RoomReply {
    const target = this.bound(socketId);
    if (!target) return { ok: false, code: "NOT_AUTHORIZED" };
    const { room, member } = target;
    if (room.authority) {
      if (discard) {
        member.discardOnLeave = true;
        if (room.members.every((p) => p.discardOnLeave)) {
          const reply = this.reply(room, member);
          this.remove(room);
          return reply;
        }
      }
      this.disconnect(socketId);
      return this.reply(room, member);
    }
    this.bindings.delete(socketId);
    this.secrets.delete(member.tokenHash);
    room.members = room.members.filter((p) => p.id !== member.id);
    if (room.hostId === member.id) room.hostId = room.members[0]?.id ?? "";
    const reply = this.reply(room, member);
    if (!room.members.length) this.remove(room);
    else this.publish(room);
    return reply;
  }
  private remove(room: Room) {
    for (const member of room.members) {
      this.secrets.delete(member.tokenHash);
      if (member.socketId) this.bindings.delete(member.socketId);
    }
    this.rooms.delete(room.id);
    this.codes.delete(room.code);
  }
  sweep() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      let changed = false;
      if (room.closedAt !== null) {
        if (now - room.closedAt >= 600000) this.remove(room);
        continue;
      }
      if (!room.authority) {
        for (const member of [...room.members])
          if (
            member.disconnectedAt !== null &&
            now - member.disconnectedAt >= 120000
          ) {
            changed = true;
            this.secrets.delete(member.tokenHash);
            room.members = room.members.filter((p) => p !== member);
            if (room.hostId === member.id)
              room.hostId =
                room.members.find((p) => p.socketId)?.id ??
                room.members[0]?.id ??
                "";
          }
        if (!room.members.length) {
          this.remove(room);
          continue;
        }
        if (now - room.lastActivity >= 1800000) {
          room.closedAt = now;
          room.reason = "Phòng chờ đã hết hạn do không hoạt động.";
          changed = true;
        }
      } else if (
        room.members.every((p) => !p.socketId) &&
        now - room.lastActivity >= 1800000
      ) {
        room.closedAt = now;
        room.reason = "Ván hết hạn sau 30 phút không có người kết nối.";
        changed = true;
      }
      if (changed || this.canEnd(room) !== room.publishedCanEnd)
        this.publish(room);
    }
  }
  closeAll() {
    this.draining = true;
    for (const room of this.rooms.values()) {
      room.closedAt = this.now();
      room.reason =
        "Máy chủ đang dừng. Ván online không thể tiếp tục sau khi máy chủ khởi động lại.";
      this.publish(room);
    }
  }
}
