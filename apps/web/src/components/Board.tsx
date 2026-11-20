import { BOARD } from "@nha-choi/game-core";
import type { GameEvent, PlayerView } from "@nha-choi/game-core";
import { useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import photos from "../locations.json";
import { Wallet } from "./Wallet.js";
import { Dice } from "./Dice.js";
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
export function movementPath(start: number, end: number, events: GameEvent[]) {
  const roll = events.find((event) => event.type === "roll")?.amount;
  const landed = events.find((event) => event.type === "land")?.spaceId;
  const path = [start];
  if (roll && roll <= 12 && (start + roll) % BOARD.length === landed)
    for (let step = 1; step <= roll; step++)
      path.push((start + step) % BOARD.length);
  if (path[path.length - 1] !== end) path.push(end);
  return path;
}

export function Board({
  view,
  onSelect,
}: {
  view: PlayerView;
  onSelect: (spaceId: number) => void;
}) {
  const rollId = [...view.recentEvents]
    .reverse()
    .find((event) => event.type === "roll")?.id;
  const initialRoll = useRef(rollId);
  const animateRoll = Boolean(view.turn.dice && rollId !== initialRoll.current);
  const self = view.players.find((player) => player.id === view.viewerId);
  const board = useRef<HTMLDivElement>(null);
  const previous = useRef(view);
  const previousSlots = useRef(new Map<string, readonly [number, number]>());
  useLayoutEffect(() => {
    const root = board.current!;
    const tile = root.querySelector(".board-cell")!;
    const measure = () => {
      const { width, height } = tile.getBoundingClientRect();
      if (width && height)
        root.style.setProperty("--tile-side", `${Math.min(width, height)}px`);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(tile);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = view;
    const root = board.current!;
    const cells = root.querySelectorAll(".board-cell");
    const pawns = new Map<string, HTMLElement>();
    const slots = new Map<string, readonly [number, number]>();
    for (const pawn of root.querySelectorAll<HTMLElement>(".board-pawn")) {
      const id = pawn.dataset.playerId!;
      const cell = pawn.closest(".board-cell")!.getBoundingClientRect();
      const layer = pawn.parentElement!.getBoundingClientRect();
      pawns.set(id, pawn);
      if (cell.width && cell.height)
        slots.set(id, [
          (layer.left + pawn.offsetLeft + pawn.offsetWidth / 2 - cell.left) /
            cell.width,
          (layer.top + pawn.offsetTop + pawn.offsetHeight / 2 - cell.top) /
            cell.height,
        ]);
    }
    const oldSlots = previousSlots.current;
    previousSlots.current = slots;
    if (
      before.gameId !== view.gameId ||
      before.revision >= view.revision ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const lastId = before.recentEvents[before.recentEvents.length - 1]?.id ?? 0;
    function point(
      position: number,
      slot: readonly [number, number] = [0.5, 0.5],
    ) {
      const rect = cells[position]!.getBoundingClientRect();
      return [
        rect.left + rect.width * slot[0],
        rect.top + rect.height * slot[1],
      ] as const;
    }
    for (const player of view.players) {
      const old = before.players.find((value) => value.id === player.id);
      if (!old || player.bankrupt) continue;
      const events = view.recentEvents.filter(
        (e) => e.id > lastId && e.playerId === player.id,
      );
      const path = movementPath(old.position, player.position, events);
      if (path.length < 2) continue;
      const pawn = pawns.get(player.id);
      if (!pawn?.animate) continue;
      const destination = point(player.position, slots.get(player.id));
      const [x, y] = destination;
      const stepDuration = 175;
      const delay = events.some((event) => event.type === "roll") ? 820 : 0;
      const points = [
        point(old.position, oldSlots.get(player.id)),
        ...path.slice(1, -1).map((position) => point(position)),
        destination,
      ];
      const frames: Keyframe[] = [
        {
          transform: `translate(${points[0]![0] - x}px, ${points[0]![1] - y}px)`,
        },
      ];
      for (let step = 1; step < points.length; step++) {
        const [left, top] = points[step]!;
        const [fromLeft, fromTop] = points[step - 1]!;
        frames.push(
          {
            transform: `translate(${(left + fromLeft) / 2 - x}px, ${(top + fromTop) / 2 - y - 10}px) scale(1.08)`,
          },
          { transform: `translate(${left - x}px, ${top - y}px)` },
        );
        cells[path[step]!]?.animate?.(
          [
            { boxShadow: "inset 0 0 0 3px #ffcb5966" },
            { boxShadow: "inset 0 0 0 3px #ffcb59" },
            { boxShadow: "inset 0 0 0 3px #ffcb5900" },
          ],
          {
            delay: delay + step * stepDuration,
            duration: 470,
            easing: "ease-out",
          },
        );
      }
      pawn.animate(frames, {
        delay,
        duration: (path.length - 1) * stepDuration,
        fill: "backwards",
      });
    }
  }, [view]);
  return (
    <div className="board-wrap">
      <div className="board" ref={board} aria-label="Bàn Cờ tỷ phú, 40 ô">
        <div className="board-center">
          <span className="board-brand">nhà chơi.</span>
          <h1>Cờ tỷ phú</h1>
          <Dice key={rollId} result={view.turn.dice} rolling={animateRoll} />
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
              className={`board-cell ${self && !self.bankrupt && self.position === space.id ? "your-space" : ""} ${visitors.length ? "occupied" : ""} ${photo ? "has-photo" : "special"} ${visitors.some((p) => p.id === view.turn.playerId) ? "current" : ""}`}
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
                  data-columns={
                    visitors.length > 4 ? 3 : visitors.length > 1 ? 2 : 1
                  }
                  aria-hidden="true"
                >
                  {visitors.map((p) => (
                    <span
                      key={p.id}
                      data-player-id={p.id}
                      className={`board-pawn ${p.id === view.viewerId ? "own-pawn" : ""}`}
                      title={
                        p.id === view.viewerId ? `${p.name} (bạn)` : p.name
                      }
                    >
                      <span className="pawn-model">
                        <span className="pawn-plinth" />
                        <TokenArt token={p.token} />
                      </span>
                      {p.id === view.viewerId && (
                        <span className="own-pawn-label">Bạn</span>
                      )}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="board-bottom">
        {self && !self.bankrupt && (
          <button
            type="button"
            className="your-location"
            onClick={() => onSelect(self.position)}
          >
            <TokenArt token={self.token} />
            <span>
              Bạn đang ở <strong>{BOARD[self.position]?.name}</strong>
            </span>
          </button>
        )}
        {self && <Wallet view={view} cash={self.cash} />}
      </div>
    </div>
  );
}
