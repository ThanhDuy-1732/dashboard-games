import type { LobbyView, RoomReply } from "@nha-choi/protocol";
import { TokenArt } from "../components/TokenArt.js";
import type { OnlineSession } from "../session/online.js";
import { roomError } from "../session/online.js";
import { useState } from "react";
export function Lobby({
  room,
  session,
  connected,
  onLeave,
}: {
  room: LobbyView;
  session: OnlineSession;
  connected: boolean;
  onLeave: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const self = room.players.find((p) => p.id === session.selfId);
  async function act(action: () => Promise<RoomReply>) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (!result.ok) setError(roomError(result.code));
    } catch {
      setError("Chưa gửi được. Hãy đợi kết nối rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }
  const canStart =
    room.players.length >= 2 &&
    room.players.every((p) => p.ready && p.connected);
  return (
    <section className="screen">
      <div className="page-heading">
        <div>
          <p className="welcome">Cờ tỷ phú · Online</p>
          <h1>Đợi bạn, đủ vui.</h1>
        </div>
        <button className="button secondary" onClick={onLeave}>
          Rời phòng
        </button>
      </div>
      <div className="lobby-layout">
        <div className="setup-panel lobby-invite">
          <p className="field-label">Mã phòng</p>
          <h2 className="room-code" data-testid="room-code">
            {room.code}
          </h2>
          <p>
            Gửi mã hoặc đường dẫn cho bạn bè. Mỗi người chọn một quân cờ khác
            nhau.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              const url = new URL(location.href);
              url.search = "";
              url.searchParams.set("room", room.code!);
              void navigator.clipboard
                .writeText(url.href)
                .then(() => setCopied(true))
                .catch(() => setError("Hãy sao chép mã phòng phía trên."));
            }}
          >
            {copied ? "Đã sao chép" : "Sao chép lời mời"}
          </button>
          <p className="info-note">
            2–6 người · Luật truyền thống · Không cần tài khoản
          </p>
        </div>
        <div className="setup-panel">
          <h2>Trong phòng ({room.players.length}/6)</h2>
          <ul className="lobby-players">
            {room.players.map((p) => (
              <li key={p.id}>
                <span className="lobby-token">
                  <TokenArt token={p.token} />
                </span>
                <span>
                  <strong>
                    {p.name}
                    {p.id === session.selfId ? " (bạn)" : ""}
                  </strong>
                  <small>
                    {p.id === room.hostId ? "Chủ phòng · " : ""}
                    {!p.connected
                      ? "Đang kết nối lại"
                      : p.ready
                        ? "Đã sẵn sàng"
                        : "Chưa sẵn sàng"}
                  </small>
                </span>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button
            className="button secondary full"
            disabled={busy || !connected}
            onClick={() => void act(() => session.setReady(!self?.ready))}
          >
            {self?.ready ? "Hủy sẵn sàng" : "Sẵn sàng"}
          </button>
          {room.hostId === session.selfId && (
            <button
              className="button primary full"
              disabled={busy || !connected || !canStart}
              onClick={() => void act(() => session.startGame())}
            >
              Bắt đầu ván
            </button>
          )}
          <p className="muted">
            {canStart
              ? "Mọi người đã sẵn sàng. Chủ phòng có thể bắt đầu."
              : "Chờ ít nhất 2 người kết nối và tất cả sẵn sàng."}
          </p>
        </div>
      </div>
    </section>
  );
}
