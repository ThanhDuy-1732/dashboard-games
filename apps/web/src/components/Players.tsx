import type { PlayerView } from "@nha-choi/game-core";
import { boardFor } from "@nha-choi/game-core";
import { PLAYER_COLORS } from "./Board.js";
import { TokenArt } from "./TokenArt.js";
export function Players({ view }: { view: PlayerView }) {
  const board = boardFor(view.board.length);
  return (
    <section className="players-panel">
      <div className="subsection-heading">
        <h2>Trên bàn chơi</h2>
        <span>{view.players.length} người</span>
      </div>
      {view.players.map((player, index) => (
        <div className="player-row" key={player.id}>
          <span
            className="player-avatar"
            style={{ background: `${PLAYER_COLORS[index]}20` }}
          >
            <TokenArt token={player.token} />
          </span>
          <div>
            <strong>
              {player.name}
              {player.id === view.viewerId ? " (Bạn)" : ""}
            </strong>
            <small>
              {player.bankrupt
                ? "Đã phá sản"
                : player.jail
                  ? "Đang trong tù"
                  : `${view.board.filter((p) => p.owner === player.id).length} tài sản`}
            </small>
            {!player.bankrupt && <small>{board[player.position]?.name}</small>}
          </div>
          <b>{player.cash.toLocaleString("vi-VN")}</b>
        </div>
      ))}
    </section>
  );
}
