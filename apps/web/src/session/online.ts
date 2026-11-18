import { isNative, onlineServerUrl } from "../platform.js";
import { io } from "socket.io-client";
import type { Token } from "@nha-choi/game-core";
import type {
  CommandEnvelope,
  CommandReply,
  RoomReply,
  RoomSession,
  SessionUpdate,
  LobbyView,
} from "@nha-choi/protocol";
const KEY = "nha-choi-online-v1";
export const ONLINE_URL = onlineServerUrl();
export const roomError = (code: string) =>
  ({
    SERVER_CLOSING: "Máy chủ đang bảo trì, chưa nhận phòng mới.",
    INVALID_ROOM: "Phòng không còn tồn tại. Máy chủ có thể đã khởi động lại.",
    ROOM_FULL: "Phòng đã đủ 6 người.",
    TOKEN_TAKEN: "Quân cờ này đã có người chọn. Hãy chọn quân khác.",
    NOT_HOST: "Chỉ chủ phòng mới có thể bắt đầu.",
    NOT_READY: "Cần 2–6 người kết nối và tất cả sẵn sàng.",
    GAME_STARTED: "Ván đã bắt đầu, không thể thêm người mới.",
    RATE_LIMITED: "Bạn thao tác quá nhanh. Hãy đợi một chút.",
    PROTOCOL_MISMATCH:
      "Phiên bản ứng dụng không phù hợp. Hãy cập nhật rồi mở lại.",
    NOT_AUTHORIZED: "Phiên điều khiển đã thay đổi. Hãy mở lại phòng.",
    INVALID_INPUT: "Kiểm tra tên, quân cờ và mã phòng 6 ký tự.",
  })[code] ?? "Chưa kết nối được phòng. Hãy kiểm tra mạng và thử lại.";
function stored() {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as {
      serverUrl?: unknown;
      resumeToken?: unknown;
    } | null;
    return value &&
      typeof value.serverUrl === "string" &&
      typeof value.resumeToken === "string" &&
      /^[A-Za-z0-9_-]{43}$/.test(value.resumeToken)
      ? { serverUrl: value.serverUrl, resumeToken: value.resumeToken }
      : null;
  } catch {
    return null;
  }
}
export const hasOnlineRoom = () => stored() !== null;
export interface OnlineSession extends RoomSession {
  readonly selfId: string;
  leaveRoom(): Promise<void>;
}
export async function resumeOnlineRoom(): Promise<OnlineSession> {
  const saved = stored();
  if (!saved)
    throw new Error("Không có phòng online để tiếp tục trong tab này.");
  return connect(saved.serverUrl, { resumeToken: saved.resumeToken }, true);
}
export function connectOnlineRoom(input: {
  serverUrl: string;
  name: string;
  token: Token;
  code?: string;
}): Promise<OnlineSession> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const resumeToken = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return connect(
    input.serverUrl,
    {
      name: input.name,
      token: input.token,
      ...(input.code ? { code: input.code } : {}),
      resumeToken,
    },
    false,
  );
}
async function connect(
  serverUrl: string,
  input: { resumeToken: string; name?: string; token?: Token; code?: string },
  resuming: boolean,
): Promise<OnlineSession> {
  if(isNative()&&!onlineServerUrl(serverUrl))throw new Error("Chơi online cần địa chỉ máy chủ HTTPS được cấu hình cho bản ứng dụng này. Chơi với máy vẫn hoạt động offline.");
  const record = JSON.stringify({ serverUrl, resumeToken: input.resumeToken });
  try {
    const previousRecord = sessionStorage.getItem(KEY);
    if (previousRecord !== null) sessionStorage.setItem(KEY, previousRecord);
    else {
      sessionStorage.setItem(KEY, record);
      sessionStorage.removeItem(KEY);
    }
  } catch {
    throw new Error(
      "Trình duyệt không cho lưu phiên. Hãy cho phép lưu dữ liệu để giữ ghế khi kết nối lại.",
    );
  }
  const socket = io(serverUrl, {
    autoConnect: false,
    auth: { protocolVersion: 1, rulesVersion: "classic-v1" },
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
  let active = true,
    authenticated = false,
    selfId = "",
    lobby: LobbyView | null = null;
  let update: SessionUpdate = {
    connection: "reconnecting",
    view: null,
    reason: "Đang kết nối phòng…",
  };
  const listeners = new Set<(value: SessionUpdate) => void>();
  const lobbyListeners = new Set<(value: LobbyView) => void>();
  const publish = (value: SessionUpdate) => {
    update = value;
    for (const fn of listeners) fn(value);
  };
  const publishLobby = (value: LobbyView) => {
    lobby = value;
    for (const fn of lobbyListeners) fn(value);
  };
  const forget = () => {
    if (sessionStorage.getItem(KEY) === record) sessionStorage.removeItem(KEY);
  };
  function request<T>(event: string, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!socket.connected) {
        reject(new Error("Mất kết nối. Hãy đợi phòng kết nối lại."));
        return;
      }
      socket
        .timeout(4000)
        .emit(event, payload, (err: Error | null, reply: T) =>
          err ? reject(err) : resolve(reply),
        );
    });
  }
  let resolveInitial: (value: OnlineSession) => void;
  let rejectInitial: (reason: Error) => void;
  const initial = new Promise<OnlineSession>((resolve, reject) => {
    resolveInitial = resolve;
    rejectInitial = reject;
  });
  const initialTimeout = setTimeout(() => {
    if (!selfId) {
      void session.close();
      rejectInitial(
        new Error("Không kết nối được máy chủ. Hãy kiểm tra mạng và thử lại."),
      );
    }
  }, 20000);
  const session: OnlineSession = {
    get selfId() {
      return selfId;
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(update);
      return () => {
        listeners.delete(fn);
      };
    },
    subscribeLobby(fn) {
      lobbyListeners.add(fn);
      if (lobby) fn(lobby);
      return () => {
        lobbyListeners.delete(fn);
      };
    },
    async send(command: CommandEnvelope) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!active || update.connection === "closed")
          throw new Error("Ván đã đóng.");
        if (
          !authenticated ||
          !socket.connected ||
          update.connection !== "connected"
        )
          throw new Error("Ván đang đợi kết nối.");
        try {
          return await request<CommandReply>("game:command", command);
        } catch (reason) {
          if (attempt === 1 || !authenticated || !socket.connected)
            throw reason;
        }
      }
      throw new Error("Chưa nhận được xác nhận hành động.");
    },
    setReady(ready) {
      return request("room:ready", { ready });
    },
    startGame() {
      return request("room:start", {});
    },
    endInterrupted() {
      return request("game:end-interrupted", {});
    },
    async leaveRoom() {
      try {
        if (socket.connected && authenticated)
          await request<RoomReply>("room:leave", {});
      } finally {
        if (!lobby?.started || lobby.closed) forget();
        await session.close();
      }
    },
    async close() {
      if (!active) return;
      active = false;
      clearTimeout(initialTimeout);
      authenticated = false;
      socket.disconnect();
      publish({ ...update, connection: "closed" });
      listeners.clear();
      lobbyListeners.clear();
    },
  };
  socket.on("room:update", (value: LobbyView) => {
    if (active) publishLobby(value);
  });
  socket.on("game:update", (value: SessionUpdate) => {
    if (active) publish(value);
  });
  socket.on("connect", () => {
    void (async () => {
      try {
        const reply = await request<RoomReply>(
          resuming ? "room:resume" : input.code ? "room:join" : "room:create",
          resuming ? { resumeToken: input.resumeToken } : input,
        );
        if (!active) return;
        if (!reply.ok) {
          publish({
            ...update,
            connection: "closed",
            reason: roomError(reply.code),
          });
          rejectInitial(new Error(roomError(reply.code)));
          await session.close();
          return;
        }
        sessionStorage.setItem(KEY, record);
        resuming = true;
        selfId = reply.selfId;
        authenticated = true;
        publishLobby(reply.room);
        if (!reply.room.started && !reply.room.closed)
          publish({ connection: "connected", view: null });
        clearTimeout(initialTimeout);
        resolveInitial(session);
      } catch {
        if (active) socket.io.engine?.close();
      }
    })();
  });
  socket.on("disconnect", (reason: string) => {
    authenticated = false;
    if (!active) return;
    if (reason === "io server disconnect") {
      publish({
        ...update,
        connection: "closed",
        reason:
          "Ghế của bạn đã được mở ở kết nối khác hoặc máy chủ đã đóng ván.",
      });
    } else
      publish({
        ...update,
        connection: "reconnecting",
        reason: "Mất kết nối. Đang tìm lại phòng; các thao tác tạm dừng.",
      });
  });
  socket.on("connect_error", (error: Error) => {
    if (error.message === "PROTOCOL_MISMATCH") {
      publish({
        ...update,
        connection: "closed",
        reason: roomError(error.message),
      });
      void session.close();
      rejectInitial(new Error(roomError(error.message)));
    }
  });
  socket.connect();
  return initial;
}
