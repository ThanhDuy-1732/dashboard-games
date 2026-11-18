import { useState } from "react";
import type { PlayerConfig, Token } from "@nha-choi/game-core";
import { TOKEN_ART } from "../components/Board.js";
import { Icon } from "../components/Icon.js";
export function Setup({
  onStart,
  onBack,
  busy = false,
}: {
  onStart: (human: PlayerConfig, botCount: number) => void;
  onBack: () => void;
  busy?: boolean;
}) {
  const [mode, setMode] = useState<"offline" | "online" | "bluetooth">(
    "offline",
  );
  const [name, setName] = useState("");
  const [token, setToken] = useState<Token>("car");
  const [bots, setBots] = useState(3);
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
                note: "Đang triển khai",
                color: "lavender",
              },
              {
                id: "bluetooth",
                icon: "bt",
                name: "Chơi gần nhau",
                description: "Mỗi người một điện thoại, cùng một cuộc vui.",
                note: "Bluetooth · Cần ứng dụng mobile",
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
          {mode !== "offline" ? (
            <div className="info-note">
              {mode === "bluetooth"
                ? "Mở ứng dụng Android hoặc iOS để chơi qua Bluetooth. Bản web không kết nối Bluetooth giữa các điện thoại."
                : "Chế độ online đang được triển khai. Bạn có thể chơi với máy ngay bây giờ."}
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
                  {(Object.keys(TOKEN_ART) as Token[]).map((key) => (
                    <button
                      type="button"
                      key={key}
                      className={`token-button ${token === key ? "selected" : ""}`}
                      aria-label={`Chọn quân ${key}`}
                      aria-pressed={token === key}
                      onClick={() => setToken(key)}
                    >
                      {TOKEN_ART[key]}
                    </button>
                  ))}
                </div>
              </fieldset>
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
              disabled={mode !== "offline" || busy}
            >
              Bắt đầu ván <Icon name="arrow" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
