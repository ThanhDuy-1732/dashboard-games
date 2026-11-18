import { Icon } from "../components/Icon.js";
import { boardPosition } from "../components/Board.js";
export function Home({
  onPlay,
  onRules,
}: {
  onPlay: () => void;
  onRules: () => void;
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
        <span className="quiet-tag">
          <span className="status-dot" /> Cứ vào chơi thôi
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="game-label">
            <Icon name="spark" />
            Mời bạn vào bàn
          </span>
          <h2>
            Một bàn cờ.
            <br />
            Nhiều cuộc vui.
          </h2>
          <p>
            Mua con phố bạn thích, xây ngôi nhà đầu tiên.
            <br />
            Và cùng nhau làm nên một ván đáng nhớ.
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
        <div
          className="hero-art"
          role="img"
          aria-label="Bàn cờ và những ngôi nhà"
        >
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-board">
            <div className="art-center">
              <span>nhà chơi.</span>
              <b>CỜ TỶ PHÚ</b>
              <div className="art-city">
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} className={`building b${n}`} />
                ))}
              </div>
            </div>
            {Array.from({ length: 32 }, (_, i) => {
              const [row, col] = boardPosition(i, 9);
              return (
                <div
                  key={i}
                  className="art-cell"
                  style={{ gridArea: `${row}/${col}` }}
                />
              );
            })}
          </div>
          <div className="floating-die die-one">
            {[1, 2, 3, 4].map((n) => (
              <span key={n}>●</span>
            ))}
          </div>
          <div className="art-pawn pawn-gold" />
          <div className="art-pawn pawn-purple" />
          <div className="art-caption">Đi một vòng, thêm một câu chuyện.</div>
        </div>
      </section>
      <div className="section-title">
        <h2>Ghé bàn chơi</h2>
        <span>Game đầu tiên của Nhà Chơi</span>
      </div>
      <article className="game-card">
        <div className="game-cover">
          <div className="cover-grid" />
          <span className="cover-house house-a" />
          <span className="cover-house house-b" />
          <span className="cover-coin">₫</span>
          <span className="cover-label">Cờ tỷ phú</span>
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
