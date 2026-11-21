import { trackDeviceLatency } from "../telemetry.js";
import { isNative, onlineServerUrl } from "../platform.js";
import { io } from "socket.io-client";
import { VIETNAMESE_TOKENS } from "@nha-choi/game-core";
import type { BoardSize, Token } from "@nha-choi/game-core";
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
    STORAGE_UNAVAILABLE:
      "Máy chủ chưa lưu được dữ liệu. Ván được giữ lại; hãy đợi rồi kết nối lại.",
    SERVER_CLOSING: "Máy chủ đang bảo trì, chưa nhận phòng mới.",
    INVALID_ROOM: "Phòng không còn tồn tại hoặc đã hết hạn.",
    ROOM_FULL: "Phòng đã đủ 6 người.",
    TOKEN_TAKEN: "Quân cờ này đã có người chọn. Hãy chọn quân khác.",
    NOT_HOST: "Chỉ chủ phòng mới có thể bắt đầu.",
    NOT_READY: "Cần 2–6 người kết nối và tất cả sẵn sàng.",
    GAME_STARTED: "Ván đã bắt đầu, không thể thêm người mới.",
    UNSUPPORTED_BOARD: "Hãy cập nhật Nhà Chơi để vào phòng có kích thước bàn này.",
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
function createSocket(serverUrl: string) {
  return io(serverUrl, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    auth: {
      protocolVersion: 1,
      rulesVersion: "classic-v1",
      compactBoard: true,
      mediumBoard: true,
    },
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
}
let prepared: {
  serverUrl: string;
  socket: ReturnType<typeof createSocket>;
} | null = null;
export function prepareOnlineConnection(serverUrl: string) {
  const socket = createSocket(serverUrl);
  prepared = { serverUrl, socket };
  socket.connect();
  return () => {
    // A submitted form transfers this socket to the room session.
    if (prepared?.socket !== socket) return;
    prepared = null;
    socket.disconnect();
  };
}
export interface OnlineSession extends RoomSession {
  readonly selfId: string;
  leaveRoom(discard?: boolean): Promise<void>;
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
  boardSize?: BoardSize;
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
      ...(!input.code && input.boardSize !== undefined && input.boardSize !== 40
        ? { boardSize: input.boardSize }
        : {}),
      resumeToken,
    },
    false,
  );
}
async function connect(
  serverUrl: string,
  input: {
    resumeToken: string;
    name?: string;
    token?: Token;
    code?: string;
    boardSize?: BoardSize;
  },
  resuming: boolean,
): Promise<OnlineSession> {
  if (isNative() && !onlineServerUrl(serverUrl))
    throw new Error(
      "Chơi online cần địa chỉ máy chủ HTTPS được cấu hình cho bản ứng dụng này. Chơi với máy vẫn hoạt động offline.",
    );
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
  const socket =
    prepared?.serverUrl === serverUrl
      ? prepared.socket
      : createSocket(serverUrl);
  if (prepared?.socket === socket) prepared = null;
  let active = true,
    authenticated = false,
    selfId = "",
    lobby: LobbyView | null = null;
  let update: SessionUpdate = {
    connection: "reconnecting",
    view: null,
    reason: "Đang kết nối phòng…",
  };
  let serverUpdate: SessionUpdate | null = null;
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
      const start = performance.now();
      socket.timeout(4000).emit(event, payload, (err: Error | null, reply: T) => {
        if (event === "game:command") {
          const code = (reply as { code?: string } | undefined)?.code;
          trackDeviceLatency(start, Boolean(err) || code === "STORAGE_UNAVAILABLE");
        }
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }
  let resolveInitial: (value: OnlineSession) => void;
  let rejectInitial: (reason: Error) => void;
  const initial = new Promise<OnlineSession>((resolve, reject) => {
    resolveInitial = resolve;
    rejectInitial = reject;
  });
  const initialTimeout = setTimeout(
    () => {
      if (!selfId) {
        void session.close();
        rejectInitial(
          new Error("Máy chủ chưa phản hồi. Hãy thử lại sau ít giây."),
        );
      }
    },
    /^https:\/\/[^/]+\.onrender\.com(?:[:/]|$)/i.test(serverUrl)
      ? 70000
      : 20000,
  );
  const session: OnlineSession = {
    async setActive(foreground) {
      if (!active || update.connection === "closed") return;
      if (!foreground) {
        socket.disconnect();
        authenticated = false;
        publish({
          ...update,
          connection: "paused",
          reason: "Ứng dụng đang ở nền. Ván tạm dừng cho tới khi kết nối lại.",
        });
      } else if (!socket.connected) {
        publish({
          ...update,
          connection: "reconnecting",
          reason: "Đang đồng bộ lại phòng…",
        });
        socket.connect();
      }
    },
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
    async leaveRoom(discard = false) {
      if (socket.connected && authenticated) {
        const reply = await request<RoomReply>(
          "room:leave",
          discard ? { discard } : {},
        );
        if (!reply.ok) throw new Error(roomError(reply.code));
      } else if (discard || (!lobby?.started && !lobby?.closed))
        throw new Error(
          "Chưa xác nhận rời phòng. Hãy kết nối lại rồi thử tiếp.",
        );
      if (discard || !lobby?.started || lobby.closed) forget();
      await session.close();
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
    serverUpdate = value;
    if (active)
      publish(
        authenticated || value.connection === "closed"
          ? value
          : {
              ...value,
              connection: "reconnecting",
              reason: "Đang xác thực và đồng bộ lại phòng…",
            },
      );
  });
  const enterRoom = () => {
    serverUpdate = null;
    void (async () => {
      try {
        const requestedSize = !resuming ? input.boardSize : undefined;
        const oldServerMessage = `Máy chủ online chưa hỗ trợ bàn ${requestedSize} ô. Bạn vẫn có thể chơi bàn này với máy.`;
        const reply = await request<RoomReply>(
          resuming ? "room:resume" : input.code ? "room:join" : "room:create",
          resuming ? { resumeToken: input.resumeToken } : input,
        );
        if (!active) return;
        if (!reply.ok) {
          if (
            [
              "STORAGE_UNAVAILABLE",
              "SERVER_ERROR",
              "SERVER_CLOSING",
              "RATE_LIMITED",
            ].includes(reply.code)
          ) {
            authenticated = false;
            publish({
              ...update,
              connection: "reconnecting",
              reason: roomError(reply.code),
            });
            socket.io.engine?.close();
            return;
          }
          const reason =
            reply.code === "INVALID_INPUT" && requestedSize === 32
              ? oldServerMessage
              : reply.code === "INVALID_INPUT" &&
            !resuming &&
            VIETNAMESE_TOKENS.some((token) => token === input.token)
              ? "Máy chủ online chưa hỗ trợ quân này. Hãy chọn một quân khác hoặc dùng quân này khi chơi với máy."
              : roomError(reply.code);
          publish({
            ...update,
            connection: "closed",
            reason,
          });
          rejectInitial(new Error(reason));
          await session.close();
          return;
        }
        if (requestedSize !== undefined && reply.room.boardSize !== requestedSize) {
          await request<RoomReply>("room:leave", {}).catch(() => {});
          rejectInitial(new Error(oldServerMessage));
          await session.close();
          return;
        }
        sessionStorage.setItem(KEY, record);
        resuming = true;
        selfId = reply.selfId;
        authenticated = true;
        publishLobby(reply.room);
        if (serverUpdate) publish(serverUpdate);
        else if (!reply.room.started && !reply.room.closed)
          publish({ connection: "connected", view: null });
        clearTimeout(initialTimeout);
        resolveInitial(session);
      } catch {
        if (active) socket.io.engine?.close();
      }
    })();
  };
  socket.on("connect", enterRoom);
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
  if (socket.connected) enterRoom();
  else socket.connect();
  return initial;
}
