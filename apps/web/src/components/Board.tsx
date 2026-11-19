import { BOARD } from "@nha-choi/game-core";
import type { PlayerView } from "@nha-choi/game-core";
import type { CSSProperties } from "react";
import photos from "../locations.json";
import { TokenArt } from "./TokenArt.js";
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
  const self = view.players.find((player) => player.id === view.viewerId);
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
              className={`board-cell ${visitors.length ? "occupied" : ""} ${photo ? "has-photo" : "special"} ${visitors.some((p) => p.id === view.turn.playerId) ? "current" : ""}`}
              style={
                {
                  gridArea: `${row}/${col}`,
                  "--strip": space.color ?? "#9bb4a0",
                } as CSSProperties
              }
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
                <span className="cell-symbol" aria-hidden="true">
                  {SYMBOLS[space.kind] ?? "♜"}
                </span>
              )}
              <span className="cell-name">{space.name}</span>
              {space.price && <span className="cell-price">{space.price}</span>}
              <span className="sr-only">
                {property.owner
                  ? `, chủ ${view.players[ownerIndex]!.name}`
                  : ", chưa có chủ"}
                {property.mortgaged ? ", đang thế chấp" : ""}
                {property.buildings
                  ? `, ${property.buildings === 5 ? "khách sạn" : `${property.buildings} nhà`}`
                  : ""}
                {visitors.length
                  ? `, có ${visitors.map((p) => (p.id === view.viewerId ? `${p.name} (bạn)` : p.name)).join(", ")}`
                  : ""}
              </span>
              {ownerIndex >= 0 && (
                <span
                  className="cell-owner"
                  style={{ background: PLAYER_COLORS[ownerIndex] }}
                  title={`Chủ: ${view.players[ownerIndex]!.name}`}
                  aria-hidden="true"
                >
                  {view.players[ownerIndex]!.name[0]}
                </span>
              )}
              {property.buildings > 0 && (
                <span className="cell-buildings" aria-hidden="true">
                  {property.buildings === 5 ? "🏨" : `⌂${property.buildings}`}
                </span>
              )}
              {property.mortgaged && (
                <span className="cell-mortgage" aria-hidden="true">
                  M
                </span>
              )}
              {visitors.length > 0 && (
                <span
                  className={`cell-pawns ${visitors.length > 1 ? "group" : ""}`}
                  data-edge={
                    row === 11
                      ? "bottom"
                      : row === 1
                        ? "top"
                        : col === 1
                          ? "left"
                          : "right"
                  }
                  data-corner={
                    col === 1 ? "left" : col === 11 ? "right" : undefined
                  }
                  aria-hidden="true"
                >
                  {visitors.map((p) => (
                    <span
                      key={p.id}
                      className={`board-pawn ${p.id === view.viewerId ? "own-pawn" : ""}`}
                      title={
                        p.id === view.viewerId ? `${p.name} (bạn)` : p.name
                      }
                    >
                      <TokenArt token={p.token} />
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
          Luật truyền thống · Lượt {view.turn.number}
        </span>
        {self && !self.bankrupt && (
          <span className="your-location">
            <TokenArt token={self.token} /> Bạn ở {BOARD[self.position]?.name}
          </span>
        )}
      </div>
    </div>
  );
}
