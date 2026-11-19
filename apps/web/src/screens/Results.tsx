import type { PlayerView } from "@nha-choi/game-core";
import { Players } from "../components/Players.js";
import { TokenArt } from "../components/TokenArt.js";
export function Results({
  view,
  onHome,
  onAgain,
}: {
  view: PlayerView;
  onHome: () => void;
  onAgain: () => void;
}) {
  const winner = view.players.find((p) => p.id === view.winner);
  return (
    <section className="results-screen">
      <div className="result-token">
        {winner ? <TokenArt token={winner.token} /> : "🏡"}
      </div>
      <span className="tag green">Ván đấu kết thúc</span>
      <h1>{winner ? `${winner.name} chiến thắng!` : "Ván đấu đã kết thúc"}</h1>
      <p>
        {winner
          ? "Người cuối cùng chưa phá sản đã làm chủ cuộc chơi."
          : "Không tính người thắng cho ván bị gián đoạn."}
      </p>
      <Players view={view} />
      <div className="action-row">
        <button className="button primary" onClick={onAgain}>
          Chơi ván mới
        </button>
        <button className="button secondary" onClick={onHome}>
          Về trang chủ
        </button>
      </div>
    </section>
  );
}
