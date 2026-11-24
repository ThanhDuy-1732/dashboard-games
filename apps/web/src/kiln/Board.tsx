import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { inspectKilnMove, kilnPotteryState } from "@nha-choi/game-core";
import type { KilnGame, KilnMove, KilnPiece, KilnPlacement, KilnSlot, KilnTile } from "@nha-choi/game-core";

type Lift = { slot: KilnSlot; tile: number; gap: number };
type Drag = Lift & { pointer: number; x: number; y: number; touch: boolean; moved: boolean };
export type KilnBurst = {
  turn: number;
  anchor: number;
  label: string;
  points: number;
  highlight: boolean;
  opened: readonly number[];
  tiles: ReadonlyMap<number, KilnTile["glaze"] | "gold">;
};

function positionLift(element: HTMLSpanElement | null, drag: Drag) {
  if (!element) return;
  const offset = drag.touch ? Math.min(28, drag.tile * 0.85) : 0;
  const left = drag.x - drag.tile / 2;
  const top = drag.y - drag.tile / 2 - offset;
  element.style.transform = `translate3d(${left}px, ${top}px, 0)`;
}

function PieceShape({ piece, style }: { piece: KilnPiece; style?: CSSProperties }) {
  return (
    <span className="kiln-piece-shape" aria-hidden="true" style={style}>
      {piece.offsets.map(([row, col], offset) => (
        <span
          key={offset}
          className={`kiln-mini kiln-${piece.glaze}`}
          style={{ gridRow: row + 1, gridColumn: col + 1 }}
        >
          {offset === piece.potteryOffset && <span className="kiln-vase" />}
        </span>
      ))}
    </span>
  );
}

export function KilnBoard({ game, burst, onMove, onBurstEnd }: {
  game: KilnGame;
  burst: KilnBurst | null;
  onMove: (move: KilnMove) => KilnPlacement | undefined;
  onBurstEnd: (turn: number) => void;
}) {
  const { size } = game;
  const board = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const liftElement = useRef<HTMLSpanElement>(null);
  const [chosen, setChosen] = useState<KilnSlot>(0);
  const [focused, setFocused] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [lift, setLift] = useState<Lift | null>(null);
  const [landed, setLanded] = useState<{ turn: number; cells: readonly number[] } | null>(null);
  const playing = game.status === "playing";
  const selection = (game.tray[chosen] ? chosen : game.tray.findIndex(Boolean)) as KilnSlot | -1;
  const preview = hover !== null && selection !== -1
    ? inspectKilnMove(game, { slot: selection, anchor: hover })
    : null;
  const liftedPiece = lift && game.tray[lift.slot];

  function place(move: KilnMove) {
    const result = onMove(move);
    if (!result) return;
    const cells = result.placed.filter(index => !result.cleared.includes(index));
    setLanded(cells.length ? { turn: game.turn + 1, cells } : null);
  }

  function cellAt(x: number, y: number) {
    const cell = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>("[data-kiln-cell]");
    return cell && board.current?.contains(cell) ? Number(cell.dataset.kilnCell) : null;
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, slot: KilnSlot) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
    const first = cellRefs.current[0]?.getBoundingClientRect();
    const second = cellRefs.current[1]?.getBoundingClientRect();
    if (!first || !second) return;
    setChosen(slot);
    setHover(null);
    drag.current = {
      pointer: event.pointerId,
      slot,
      x: event.clientX,
      y: event.clientY,
      tile: first.width,
      gap: Math.max(0, second.left - first.right),
      touch: event.pointerType === "touch",
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function trackDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (active?.pointer !== event.pointerId) return;
    const { clientX: x, clientY: y } = event;
    if (!active.moved) {
      if (Math.hypot(x - active.x, y - active.y) < 7) return;
      active.moved = true;
      setLift({ slot: active.slot, tile: active.tile, gap: active.gap });
    }
    active.x = x;
    active.y = y;
    positionLift(liftElement.current, active);
    setHover(cellAt(x, y));
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    const active = drag.current;
    if (active?.pointer !== event.pointerId) return;
    drag.current = null;
    setLift(null);
    setHover(null);
    if (commit && active.moved) {
      const anchor = cellAt(event.clientX, event.clientY);
      if (anchor !== null) place({ slot: active.slot, anchor });
    }
  }

  function moveFocus(event: KeyboardEvent, index: number) {
    const row = Math.floor(index / size);
    const col = index % size;
    const offsets: Record<string, readonly [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const nextRow = row + offset[0];
    const nextCol = col + offset[1];
    if (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size) {
      cellRefs.current[nextRow * size + nextCol]?.focus();
    }
  }

  return (
    <div className="kiln-play">
      <div
        className={`kiln-board${lift ? " is-dragging" : ""}`}
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        ref={board}
        role="group"
        aria-label={`Bàn xếp khối ${size} × ${size}`}
        aria-describedby="kiln-input-help"
        onPointerLeave={() => { if (!drag.current) setHover(null); }}
      >
        {game.board.map((tile, index) => {
          const row = Math.floor(index / size) + 1;
          const column = index % size + 1;
          const lock = game.locks?.find(entry => entry.index === index);
          const age = tile?.placedAt == null ? null : game.turn - tile.placedAt;
          const state = age === null ? null : kilnPotteryState(age);
          const mark = state === "raw" ? String(2 - age!) : state === "ready" ? "✦" : "ϟ";
          const label = lock ? `ô khóa, còn ${lock.remaining} ${lock.kind === "turns" ? "lượt đặt" : "hàng hoặc cột cần xóa"}`
            : state === "raw" ? `gốm còn ${mark} nhịp`
            : state === "ready" ? "gốm chín"
              : state === "broken" ? "gốm nứt"
                : tile ? "đã có khối" : "ô trống";
          const clear = preview?.cleared.includes(index);
          const pickUp = preview?.collected.includes(index);
          const hint = game.level === 1 && game.turn === 0 && selection === 0 && row === 2 && column >= size - 1;
          const burstColor = burst?.tiles.get(index);
          const distance = burst
            ? Math.abs(row - 1 - Math.floor(burst.anchor / size)) + Math.abs(column - 1 - burst.anchor % size)
            : 0;
          const className = [
            "kiln-cell",
            lock && `kiln-locked kiln-lock-${lock.kind}`,
            tile && `kiln-${tile.glaze}`,
            state && `kiln-${state}`,
            hint && "kiln-hint",
            preview?.placed.includes(index) && `kiln-ghost kiln-${game.tray[selection as KilnSlot]?.glaze}`,
            hover === index && (preview ? "kiln-anchor" : lift && "kiln-blocked-target"),
            clear && "kiln-clear",
            pickUp && "kiln-pickup",
          ].filter(Boolean).join(" ");
          return (
            <button
              type="button"
              key={index}
              ref={element => { cellRefs.current[index] = element; }}
              className={className}
              data-kiln-cell={index}
              data-kiln-lock={lock?.kind}
              aria-label={`Hàng ${row}, cột ${column}, ${label}`}
              aria-disabled={!playing}
              tabIndex={index === focused ? 0 : -1}
              onFocus={event => {
                setFocused(index);
                if (event.currentTarget.matches(":focus-visible")) setHover(index);
              }}
              onBlur={() => { if (!drag.current) setHover(null); }}
              onPointerEnter={event => { if (event.pointerType === "mouse" && !drag.current) setHover(index); }}
              onKeyDown={event => moveFocus(event, index)}
              onClick={() => {
                if (playing && selection !== -1) place({ slot: selection, anchor: index });
                setHover(null);
              }}
            >
              {lock && (
                <span className="kiln-lock-marker" aria-hidden="true">
                  <span>{lock.kind === "turns" ? "⌛︎" : "✷"}</span>
                  <strong>{lock.remaining}</strong>
                </span>
              )}
              {burst?.opened.includes(index) && <span key={`unlock-${burst.turn}`} className="kiln-unlock" aria-hidden="true" />}
              {state && <><span className="kiln-vase" aria-hidden="true" /><span className="kiln-mark" aria-hidden="true">{pickUp ? "✦" : mark}</span></>}
              {landed?.cells.includes(index) && (
                <span
                  key={`landed-${landed.turn}`}
                  className="kiln-landed"
                  aria-hidden="true"
                  onAnimationEnd={() => setLanded(current => current === landed ? null : current)}
                />
              )}
              {burst && burstColor && (
                <span
                  key={burst.turn}
                  className={`kiln-burst is-${burstColor}`}
                  aria-hidden="true"
                  style={{ "--kiln-wave-delay": `${Math.min(180, distance * 28)}ms` } as CSSProperties}
                >
                  <span className="kiln-shard" /><span className="kiln-shard" />
                  <span className="kiln-shard" /><span className="kiln-shard" />
                  {burstColor === "gold" && <span className="kiln-harvest kiln-vase" />}
                </span>
              )}
            </button>
          );
        })}
        {preview?.order?.outcome === "completed" && (
          <span className="kiln-contract-preview">
            {preview.collected.length > 0 && `Lấy ${preview.collected.length} bình · `}Hoàn thành đơn +{preview.order.bonus}
          </span>
        )}
        {burst && (
          <span
            key={`result-${burst.turn}`}
            className={`kiln-result${burst.highlight ? " kiln-result-highlight" : ""}`}
            aria-hidden="true"
            onAnimationEnd={event => { if (event.target === event.currentTarget) onBurstEnd(burst.turn); }}
          >
            <span>{burst.label}</span>
            <strong>+{burst.points}</strong>
          </span>
        )}
      </div>
      <div className="kiln-tray" role="group" aria-label="Mảnh ghép">
        {game.tray.map((piece, index) => {
          const slot = index as KilnSlot;
          return (
            <button
              type="button"
              key={index}
              className={`kiln-piece${lift?.slot === slot ? " is-lifted" : ""}`}
              aria-label={piece?.name ?? `Mảnh ${index + 1} đã dùng`}
              aria-pressed={playing && selection === slot}
              disabled={!playing || !piece}
              onClick={() => { setChosen(slot); setHover(null); }}
              onPointerDown={event => beginDrag(event, slot)}
              onPointerMove={trackDrag}
              onPointerUp={event => endDrag(event, true)}
              onPointerCancel={event => endDrag(event, false)}
              onLostPointerCapture={event => endDrag(event, false)}
            >
              {piece ? <PieceShape piece={piece} /> : <span aria-hidden="true">·</span>}
            </button>
          );
        })}
      </div>
      {lift && liftedPiece && (
        <span
          className="kiln-lift"
          data-drop={hover === null ? "outside" : preview ? "fit" : "blocked"}
          aria-hidden="true"
          ref={element => {
            liftElement.current = element;
            if (drag.current) positionLift(element, drag.current);
          }}
        >
          <PieceShape piece={liftedPiece} style={{ gridAutoColumns: lift.tile, gridAutoRows: lift.tile, gap: lift.gap }} />
        </span>
      )}
      <p className="kiln-input-help" id="kiln-input-help">Kéo mảnh vào bàn, hoặc chọn mảnh rồi chạm ô ứng với góc trên trái của mảnh.</p>
    </div>
  );
}
