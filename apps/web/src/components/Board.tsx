import { BOARD } from "@nha-choi/game-core";
import type { PlayerView } from "@nha-choi/game-core";
import type { CSSProperties } from "react";
import photos from "../locations.json";
export const TOKEN_ART = {
  car: "🚙",
  cat: "🐈",
  hat: "🎩",
  ship: "⛵",
  dog: "🐕",
  plane: "✈️",
};
export const PLAYER_COLORS = [
  "#0d6758",
  "#8372b5",
  "#c79c32",
  "#b2604d",
  "#4b8da9",
  "#8b9854",
];
export function boardPosition(index: number, size: number) {
  const edge = size - 1;
  return index <= edge
    ? [size, size - index]
    : index <= edge * 2
      ? [size - (index - edge), 1]
      : index <= edge * 3
        ? [1, 1 + index - edge * 2]
        : [1 + index - edge * 3, size];
}
const SYMBOLS: Record<string, string> = {
  go: "↗",
  chance: "?",
  community: "✦",
  tax: "₫",
  jail: "▦",
  parking: "P",
  "go-to-jail": "↙",
  utility: "ϟ",
};
export function Board({
  view,
  onSelect,
}: {
  view: PlayerView;
  onSelect: (spaceId: number) => void;
}) {
  return (
    <div className="board-wrap">
      <div className="board" aria-label="Bàn Cờ tỷ phú, 40 ô">
        <div className="board-center">
          <span className="board-brand">nhà chơi.</span>
          <h1>Cờ tỷ phú</h1>
          <p>Mỗi nước đi, một cơ hội.</p>
          <div
            className="center-dice"
            aria-label={
              view.turn.dice
                ? `Xúc xắc ${view.turn.dice.join(" và ")}`
                : "Chưa gieo xúc xắc"
            }
          >
            {(view.turn.dice ?? [1, 1]).map((n, i) => (
              <div className="small-die" key={i}>
                {String.fromCodePoint(0x267f + n)}
              </div>
            ))}
          </div>
          <span className="board-center-label">Luật truyền thống</span>
          <span className="center-turn">
            Lượt {view.turn.number} ·{" "}
            {view.players.find((p) => p.id === view.turn.playerId)?.name}
          </span>
        </div>
        {BOARD.map((space) => {
          const [row, col] = boardPosition(space.id, 11);
          const photo = photos[String(space.id) as keyof typeof photos];
          const property = view.board[space.id]!;
          const ownerIndex = view.players.findIndex(
            (p) => p.id === property.owner,
          );
          const visitors = view.players.filter(
            (p) => !p.bankrupt && p.position === space.id,
          );
          return (
            <button
              type="button"
              key={space.id}
              className={`board-cell ${photo ? "has-photo" : "special"} ${visitors.some((p) => p.id === view.turn.playerId) ? "current" : ""}`}
              style={
                {
                  gridArea: `${row}/${col}`,
                  "--strip": space.color ?? "#9bb4a0",
                } as CSSProperties
              }
              aria-label={`${space.name}${property.owner ? `, chủ ${view.players[ownerIndex]!.name}` : ""}${property.mortgaged ? ", đang thế chấp" : ""}`}
              onClick={() => onSelect(space.id)}
            >
              {photo ? (
                <img
                  className="location-thumbnail"
                  src={photo.src}
                  alt=""
                  draggable={false}
                />
              ) : (
                <span className="cell-symbol">
                  {SYMBOLS[space.kind] ?? "♜"}
                </span>
              )}
              <span className="cell-name">{space.name}</span>
              {space.price && <span className="cell-price">{space.price}</span>}
              {ownerIndex >= 0 && (
                <span
                  className="cell-owner"
                  style={{ background: PLAYER_COLORS[ownerIndex] }}
                  title={`Chủ: ${view.players[ownerIndex]!.name}`}
                />
              )}
              {property.buildings > 0 && (
                <span className="cell-buildings">
                  {property.buildings === 5 ? "🏨" : `⌂${property.buildings}`}
                </span>
              )}
              {property.mortgaged && (
                <span className="cell-mortgage" aria-label="Đã thế chấp">
                  M
                </span>
              )}
              {visitors.length > 0 && (
                <span className="cell-pawns">
                  {visitors.map((p) => (
                    <span key={p.id} title={p.name}>
                      {TOKEN_ART[p.token]}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="board-bottom">
        <span>
          <span className="status-dot" />
          Luật classic-v1 · Phiên {view.revision}
        </span>
        <span>Chạm ô cờ để xem ảnh và chi tiết</span>
      </div>
    </div>
  );
}
