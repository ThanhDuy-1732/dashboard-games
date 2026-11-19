import { Icon } from "../components/Icon.js";
import { LocationPhoto } from "../components/LocationDetails.js";
import type { SavedGame } from "../storage/save-schema.js";
export function Home({
  onPlay,
  onRules,
  saved = null,
  onResume,
  busy = false,
}: {
  onPlay: () => void;
  onRules: () => void;
  saved?: SavedGame | null;
  onResume?: () => void;
  busy?: boolean;
}) {
  return (
    <section className="screen">
      <div className="page-heading">
        <div>
          <p className="welcome">Chào bạn, hôm nay chơi gì?</p>
          <h1>
            Niềm vui ở ngay đây<span>.</span>
          </h1>
        </div>
      </div>
      {saved && (
        <section className="resume-card">
          <span className="tip-icon">
            <Icon name="dice" />
          </span>
          <div>
            <h2>
              {saved.state.phase === "finished"
                ? "Ván đấu gần nhất"
                : "Tiếp tục cuộc vui"}
            </h2>
            <p>
              {saved.state.players.find((p) => p.id === saved.humanId)?.name} ·{" "}
              {saved.state.players.length} người · Lượt{" "}
              {saved.state.turn.number}
            </p>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={onResume}
          >
            {saved.state.phase === "finished" ? "Xem kết quả" : "Tiếp tục ván"}
            <Icon name="arrow" />
          </button>
        </section>
      )}
      <section className="hero">
        <div className="hero-copy">
          <span className="game-label">
            <Icon name="spark" />
            Cờ tỷ phú
          </span>
          <h2>Đi một vòng phố Việt</h2>
          <p>
            Từ phố Hàng Mã đến phố Đồng Khởi, khám phá các địa danh Việt Nam qua
            từng lượt gieo xúc xắc.
          </p>
          <button className="button primary" onClick={onPlay}>
            Chơi Cờ tỷ phú <Icon name="arrow" />
          </button>
          <div className="hero-meta">
            <span>
              <Icon name="users" />
              2–6 người
            </span>
            <span>
              <Icon name="bot" />
              Có thể đấu máy
            </span>
          </div>
        </div>
        <div className="hero-location">
          <LocationPhoto spaceId={8} />
        </div>
      </section>
      <div className="section-title">
        <h2>Ghé bàn chơi</h2>
      </div>
      <article className="game-card">
        <div className="game-cover" aria-hidden="true">
          <Icon name="dice" />
        </div>
        <div className="game-description">
          <div className="tags">
            <span className="tag green">Chiến thuật</span>
            <span className="tag">Luật truyền thống</span>
          </div>
          <h3>Cờ tỷ phú</h3>
          <p>
            Một chút may mắn. Một chút tính toán.
            <br />
            Cả một thành phố để bạn chinh phục.
          </p>
          <div className="game-modes">
            <span>
              <Icon name="bot" />
              Đấu máy offline
            </span>
            <span>
              <Icon name="users" />
              1–5 đối thủ máy
            </span>
          </div>
        </div>
        <button className="button secondary" onClick={onPlay}>
          Vào chơi <Icon name="arrow" />
        </button>
      </article>
      <div className="home-bottom">
        <div className="start-tip">
          <span className="tip-icon">
            <Icon name="users" />
          </span>
          <div>
            <h3>Cuộc vui có đủ mặt</h3>
            <p>Chọn quân cờ yêu thích và cùng chinh phục thành phố.</p>
          </div>
        </div>
        <button className="text-button" onClick={onRules}>
          Chưa biết chơi? Xem luật <Icon name="book" />
        </button>
      </div>
    </section>
  );
}
