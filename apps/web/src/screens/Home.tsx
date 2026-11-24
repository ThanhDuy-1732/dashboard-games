import { Icon } from "../components/Icon.js";
import { Flower } from "../flower/Flower.js";
import type { SavedGame } from "../storage/save-schema.js";
export function Home({
  onPlay,
  onFlower,
  onKiln,
  onDino,
  onCaro,
  onResumeCaro,
  onRules,
  saved = null,
  onResume,
  busy = false,
}: {
  onPlay: () => void;
  onFlower: () => void;
  onKiln: () => void;
  onDino: () => void;
  onCaro: () => void;
  onResumeCaro?: () => void;
  onRules: () => void;
  saved?: SavedGame | null;
  onResume?: () => void;
  busy?: boolean;
}) {
  const games = [
    {
      id: "ty-phu",
      title: "Cờ tỷ phú",
      genre: "Chiến thuật",
      art: <Icon name="dice" />,
      play: onPlay,
    },
    {
      id: "caro",
      title: "Cờ Caro",
      genre: "Đấu cờ",
      art: <span>×○</span>,
      play: onCaro,
    },
    { id: "flower", title: "Vườn Hoa", genre: "Ghép 3 hoa", art: <span>✿</span>, play: onFlower },
    {
      id: "kiln",
      title: "Lò Gốm",
      genre: "Xếp khối",
      art: <span className="kiln-vase" />,
      play: onKiln,
    },
    {
      id: "dino",
      title: "Thằn Lằn Núi Lửa",
      genre: "Chạy 3D",
      art: <span>🦖</span>,
      play: onDino,
    },
  ];
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
      <section className="hero" aria-labelledby="home-games-title">
        <h2 id="home-games-title">Chọn trò để chơi</h2>
        <div className="hero-games">
          {games.map(({ id, title, genre, art, play }) => (
            <button
              key={id}
              type="button"
              className={`hero-game hero-game-${id}`}
              aria-label={title}
              onClick={play}
            >
              <span className="hero-game-art" aria-hidden="true">
                {art}
              </span>
              <span className="hero-game-title">{title}</span>
              <span className="hero-game-genre">{genre}</span>
            </button>
          ))}
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
          Chơi Cờ tỷ phú <Icon name="arrow" />
        </button>
      </article>
      <article className="game-card caro-home-card">
        <div className="game-cover caro-cover" aria-hidden="true">
          <div data-mark="X">X</div>
          <div />
          <div data-mark="O">O</div>
          <div />
          <div data-mark="X">X</div>
          <div data-mark="O">O</div>
          <div />
          <div />
          <div data-mark="X">X</div>
        </div>
        <div className="game-description">
          <h3>Cờ Caro</h3>
          <p>Xếp đúng năm quân liên tiếp trên bàn 15 × 15.</p>
          <div className="game-modes">
            <span>
              <Icon name="users" /> Hai người
            </span>
            <span>
              <Icon name="bot" /> Có thể đấu máy
            </span>
          </div>
        </div>
        <div className="caro-home-actions">
          <button className="button secondary" onClick={onCaro}>
            Chơi Cờ Caro <Icon name="arrow" />
          </button>
          {onResumeCaro && (
            <button className="text-button" onClick={onResumeCaro}>
              Mở ván Caro đã lưu
            </button>
          )}
        </div>
      </article>
      <article className="game-card">
        <div className="game-cover kiln-cover" aria-hidden="true"><span className="kiln-vase" /></div>
        <div className="game-description">
          <h3>Lò Gốm</h3>
          <p>Xếp khối, canh lửa và lấy gốm đúng lúc trong ba màn chơi offline.</p>
        </div>
        <button className="button secondary" onClick={onKiln}>Chơi Lò Gốm<Icon name="arrow" /></button>
      </article>
      <article className="game-card">
        <div className="game-cover" aria-hidden="true">🦖</div>
        <div className="game-description">
          <div className="tags">
            <span className="tag green">Chạy vô tận 3D</span>
            <span className="tag">Chơi offline</span>
          </div>
          <h3>Thằn Lằn Núi Lửa</h3>
          <p>Nhảy qua khe dung nham và đá lăn với hai góc nhìn.</p>
        </div>
        <button className="button secondary" onClick={onDino}>
          Chơi Thằn Lằn Núi Lửa <Icon name="arrow" />
        </button>
      </article>
      <article className="game-card flower-home-card">
        <div className="game-cover flower-cover" aria-hidden="true"><Flower color={0} /><Flower color={1} /><Flower color={3} /></div>
        <div className="game-description">
          <div className="tags"><span className="tag green">Ghép 3 hoa</span><span className="tag">Chơi offline</span></div>
          <h3>Vườn Hoa</h3>
          <p>Kéo đổi chỗ, ghép ba hoa cùng màu.<br />Chơi một ván nhanh hoặc khám phá 12 khu vườn.</p>
        </div>
        <button className="button secondary" onClick={onFlower}>Chơi Vườn Hoa<Icon name="arrow" /></button>
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
