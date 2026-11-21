import { trackDeviceLatency } from "../telemetry.js";
import { useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { io } from "socket.io-client";
import type { CaroMark } from "@nha-choi/game-core";
import type {
  CaroRoomError,
  CaroRoomReply,
  CaroRoomView,
} from "@nha-choi/protocol";
import { isNative, onlineServerUrl } from "../platform.js";

const KEY = "nha-choi-caro-online-v1";
export const CARO_SERVER = onlineServerUrl();
export type CaroEntry = { resumeToken: string; name?: string; code?: string };
type SeatView = { room: CaroRoomView; mark: CaroMark };
const errors: Record<CaroRoomError, string> = {
  INVALID_INPUT: "Kiểm tra tên và mã phòng gồm 6 ký tự.",
  INVALID_ROOM: "Phòng Caro không còn tồn tại hoặc đã hết hạn.",
  ROOM_FULL: "Phòng Caro đã đủ hai người.",
  NOT_AUTHORIZED: "Ghế của bạn đã được mở ở kết nối khác.",
  BUSY: "Máy chủ đang bận. Hãy thử lại sau.",
  WAITING: "Đang chờ người còn lại kết nối.",
  STALE_REVISION: "Bàn vừa thay đổi. Hãy kiểm tra lại trước khi đánh.",
  INVALID_MOVE: "Nước đi hoặc yêu cầu này không còn hợp lệ.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Hãy đợi một chút.",
};

export function savedCaroEntry(): CaroEntry | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (
      saved?.server !== CARO_SERVER ||
      !/^[A-Za-z0-9_-]{43}$/.test(saved?.resumeToken ?? "")
    )
      return null;
    return { resumeToken: saved.resumeToken };
  } catch {
    return null;
  }
}

export function createCaroEntry(name: string, code?: string): CaroEntry {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const resumeToken = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return { name, code, resumeToken };
}

export function useCaroOnline(entry: CaroEntry | null) {
  const [seat, setSeat] = useState<SeatView | null>(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const action = useRef<symbol | null>(null);
  const authenticated = useRef(false);
  useEffect(() => {
    setSeat(null);
    setConnected(false);
    setPending(false);
    setCanRetry(false);
    setMessage(entry ? "Đang kết nối phòng…" : "");
    if (!entry || !CARO_SERVER) return;
    const { resumeToken } = entry;
    const socket = io(CARO_SERVER, {
      autoConnect: false,
      forceNew: true,
      transports: ["websocket", "polling"],
      tryAllTransports: true,
      reconnectionDelay: 600,
      reconnectionDelayMax: 3000,
    });
    socketRef.current = socket;
    let active = true;
    let closed = false;
    let joined = !entry.name;
    let nativeListener: ReturnType<typeof App.addListener> | undefined;
    let foreground = true;

    function clearSavedSeat() {
      try {
        if (savedCaroEntry()?.resumeToken === resumeToken)
          sessionStorage.removeItem(KEY);
      } catch {
        /* The current room remains usable without browser storage. */
      }
    }
    function close(reason: string) {
      closed = true;
      clearSavedSeat();
      socket.disconnect();
      authenticated.current = false;
      setSeat(null);
      setConnected(false);
      setCanRetry(false);
      setMessage(reason);
    }
    socket.on("connect", () => {
      setCanRetry(false);
      setMessage("Đang đồng bộ phòng…");
      socket
        .timeout(5000)
        .emit(
          joined ? "caro:resume" : "caro:enter",
          joined ? { resumeToken } : entry,
          (error: Error | null, reply: CaroRoomReply) => {
            if (!active || closed || !foreground) return;
            if (error) {
              setMessage("Máy chủ chưa phản hồi. Đang thử kết nối lại…");
              socket.io.engine?.close();
              return;
            }
            if (!reply.ok) {
              if (reply.code === "RATE_LIMITED" || reply.code === "BUSY") {
                socket.disconnect();
                setCanRetry(true);
                setMessage(errors[reply.code]);
              } else close(errors[reply.code]);
              return;
            }
            joined = true;
            let storageWarning = "";
            try {
              sessionStorage.setItem(
                KEY,
                JSON.stringify({ server: CARO_SERVER, resumeToken }),
              );
            } catch {
              storageWarning =
                "Trình duyệt không lưu phiên. Hãy giữ trang này mở để có thể kết nối lại.";
            }
            authenticated.current = true;
            setSeat({ room: reply.room, mark: reply.mark });
            setConnected(true);
            setMessage(storageWarning);
          },
        );
    });
    socket.on("caro:update", (room: CaroRoomView, mark: CaroMark) => {
      if (active && !closed && authenticated.current) setSeat({ room, mark });
    });
    socket.on("caro:closed", (reason: string) => {
      if (active) close(reason);
    });
    socket.on("disconnect", () => {
      authenticated.current = false;
      if (active && !closed) {
        setConnected(false);
        setMessage(
          foreground
            ? "Mất kết nối. Đang tìm lại phòng…"
            : "Ván đang tạm dừng khi ứng dụng ở nền.",
        );
      }
    });
    socket.on("connect_error", () => {
      if (active && foreground)
        setMessage("Chưa kết nối được máy chủ. Đang thử lại…");
    });
    if (isNative()) {
      nativeListener = App.addListener("appStateChange", ({ isActive }) => {
        if (!active || closed) return;
        foreground = isActive;
        if (isActive) socket.connect();
        else socket.disconnect();
      });
      void nativeListener.catch(() => {});
    }
    socket.connect();
    return () => {
      active = false;
      action.current = null;
      authenticated.current = false;
      socketRef.current = null;
      socket.disconnect();
      void nativeListener
        ?.then((listener) => listener.remove())
        .catch(() => {});
    };
  }, [entry]);

  function send(event: "caro:move" | "caro:rematch", index?: number) {
    const socket = socketRef.current;
    if (!socket?.connected || !authenticated.current || !seat || action.current)
      return;
    const id = Symbol();
    const start = performance.now();
    action.current = id;
    setPending(true);
    setMessage("");
    socket
      .timeout(5000)
      .emit(
        event,
        index === undefined
          ? { round: seat.room.round }
          : { index, revision: seat.room.revision },
        (error: Error | null, reply: CaroRoomReply) => {
          if (event === "caro:move") trackDeviceLatency(start, Boolean(error));
          if (action.current !== id) return;
          action.current = null;
          setPending(false);
          if (error) {
            setMessage("Chưa nhận xác nhận. Đang đồng bộ lại bàn…");
            socket.io.engine?.close();
          } else if (!reply.ok) setMessage(errors[reply.code]);
          else
            setSeat((current) =>
              current && current.room.revision >= reply.room.revision
                ? current
                : { room: reply.room, mark: reply.mark },
            );
        },
      );
  }
  return {
    seat,
    connected,
    message,
    pending,
    canRetry,
    send,
    retry: () => socketRef.current?.connect(),
  };
}
