import { TOKENS } from "@nha-choi/game-core";
import { isNative, onlineServerUrl } from "../platform.js";
import { useState } from "react";
import type { PlayerConfig, Token } from "@nha-choi/game-core";
import { TOKEN_NAMES, TokenArt } from "../components/TokenArt.js";
import { Icon } from "../components/Icon.js";
export function Setup({
  onStart,
  onBack,
  onOnline,
  onResumeOnline,
  busy = false,
}: {
  onStart: (human: PlayerConfig, botCount: number) => void;
  onBack: () => void;
  onOnline?: (input: { name: string; token: Token; code?: string }) => void;
  onResumeOnline?: () => void;
  busy?: boolean;
}) {
  const onlineConfigured = Boolean(onlineServerUrl());
  const [mode, setMode] = useState<"offline" | "online" | "bluetooth">(
    new URLSearchParams(location.search).has("room") ? "online" : "offline",
  );
  const [name, setName] = useState("");
  const [token, setToken] = useState<Token>("car");
  const [bots, setBots] = useState(3);
  const [roomCode, setRoomCode] = useState(
    new URLSearchParams(location.search).get("room") ?? "",
  );
  const [joining, setJoining] = useState(
    Boolean(new URLSearchParams(location.search).get("room")),
  );
  const [error, setError] = useState("");
  return (
    <section className="screen">
      <button className="back-link" onClick={onBack}>
        <Icon name="back" />
        Khám phá game
      </button>
      <div className="page-heading">
        <div>
          <p className="welcome">Cờ tỷ phú</p>
          <h1>Bạn muốn chơi thế nào?</h1>
        </div>
      </div>
      <div className="setup-layout">
        <div className="mode-list">
          {(
            [
              {
                id: "offline",
                icon: "bot",
                name: "Chơi với máy",
                description: "Một mình vẫn vui. Không cần kết nối mạng.",
                note: "Một người · 1–5 đối thủ máy",
                color: "mint",
              },
              {
                id: "online",
                icon: "globe",
                name: "Chơi online",
                description: "Mời bạn bè vào phòng, dù đang ở đâu.",
                note: "2–6 người · Mời bằng mã phòng",
                color: "lavender",
              },
              {
                id: "bluetooth",
                icon: "bt",
                name: "Chơi gần nhau",
                description: "Mỗi người một điện thoại, cùng một cuộc vui.",
                note: isNative()
                  ? "Bluetooth · Chưa khả dụng"
                  : "Bluetooth · Cần ứng dụng mobile",
                color: "yellow",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`mode-card ${mode === item.id ? "selected" : ""}`}
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              <span className={`mode-icon ${item.color}`}>
                <Icon name={item.icon} />
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                <em>{item.note}</em>
              </span>
              <span className="radio-dot" />
            </button>
          ))}
        </div>
        <form
          className="setup-panel"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || name.trim().length > 20) {
              setError("Nhập tên của bạn, từ 1 đến 20 ký tự.");
              return;
            }
            if (mode === "online") {
              if (!onlineConfigured) return;
              if (
                joining &&
                !/^[A-Z0-9]{6}$/.test(roomCode.trim().toUpperCase())
              ) {
                setError("Nhập mã phòng gồm 6 chữ hoặc số.");
                return;
              }
              setError("");
              onOnline?.({
                name: name.trim(),
                token,
                ...(joining ? { code: roomCode.trim().toUpperCase() } : {}),
              });
              return;
            }
            if (!Number.isInteger(bots) || bots < 1 || bots > 5) {
              setError("Chọn từ 1 đến 5 đối thủ máy.");
              return;
            }
            setError("");
            onStart(
              { id: "human", name: name.trim(), token, kind: "human" },
              bots,
            );
          }}
        >
          <div className="panel-heading">
            <span className="panel-number">
              <Icon name="dice" />
            </span>
            <div>
              <h2>Chuẩn bị ván của bạn</h2>
              <p>Chọn quân cờ, rồi để máy vào bàn cùng bạn.</p>
            </div>
          </div>
          {mode === "online" && !onlineConfigured && (
            <p className="info-note">
              Online chưa khả dụng trong bản ứng dụng này. Bạn vẫn có thể chơi
              với máy khi offline.
            </p>
          )}
          {mode === "bluetooth" ? (
            <div className="info-note">
              {isNative()
                ? "Chế độ Bluetooth chưa khả dụng trong bản ứng dụng này."
                : "Mở ứng dụng Android hoặc iOS để chơi qua Bluetooth. Bản web không kết nối Bluetooth giữa các điện thoại."}
            </div>
          ) : (
            <>
              <label className="field-label" htmlFor="human-name">
                Tên của bạn
              </label>
              <input
                id="human-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoComplete="nickname"
                placeholder="Mọi người gọi bạn là gì?"
              />
              <fieldset className="token-field">
                <legend>Chọn quân cờ</legend>
                <div className="token-options">
                  {TOKENS.map((key) => (
                    <button
                      type="button"
                      key={key}
                      className={`token-button ${token === key ? "selected" : ""}`}
                      aria-label={`Chọn quân ${TOKEN_NAMES[key]}`}
                      aria-pressed={token === key}
                      onClick={() => setToken(key)}
                    >
                      <TokenArt token={key} />
                      <span>{TOKEN_NAMES[key]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {mode === "offline" ? (
                <>
                  <label className="field-label" htmlFor="bot-count">
                    Số đối thủ máy
                  </label>
                  <input
                    id="bot-count"
                    type="number"
                    min={1}
                    max={5}
                    value={bots}
                    onChange={(e) => setBots(Number(e.target.value))}
                  />
                  <div className="info-note">
                    <Icon name="bot" />
                    Máy chơi theo cùng bộ luật với bạn.
                  </div>
                </>
              ) : (
                <>
                  <label className="field-label" htmlFor="room-choice">
                    Phòng chơi
                  </label>
                  <select
                    id="room-choice"
                    value={joining ? "join" : "create"}
                    onChange={(e) => setJoining(e.target.value === "join")}
                  >
                    <option value="create">Tạo phòng mới</option>
                    <option value="join">Vào phòng bằng mã</option>
                  </select>
                  {joining && (
                    <>
                      <label className="field-label" htmlFor="room-code">
                        Mã phòng
                      </label>
                      <input
                        id="room-code"
                        value={roomCode}
                        maxLength={6}
                        autoCapitalize="characters"
                        onChange={(e) =>
                          setRoomCode(e.target.value.toUpperCase())
                        }
                        placeholder="VD: ABC123"
                      />
                    </>
                  )}
                  {onResumeOnline && (
                    <button
                      type="button"
                      className="text-button full"
                      disabled={busy}
                      onClick={onResumeOnline}
                    >
                      Kết nối lại phòng trước
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <div className="small-rule">
              <Icon name="home" />
              Luật truyền thống · 1.500 vốn ban đầu
            </div>
            <button
              className="button primary full"
              type="submit"
              disabled={
                mode === "bluetooth" ||
                (mode === "online" && !onlineConfigured) ||
                busy
              }
            >
              {mode === "online"
                ? joining
                  ? "Vào phòng"
                  : "Tạo phòng"
                : "Bắt đầu ván"}{" "}
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
