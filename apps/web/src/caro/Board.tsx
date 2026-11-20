import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { CARO_SIZE } from "@nha-choi/game-core";
import type { CaroGame } from "@nha-choi/game-core";

export function caroCoordinate(index: number) {
  return `${String.fromCharCode(65 + (index % CARO_SIZE))}${Math.floor(index / CARO_SIZE) + 1}`;
}

export function CaroBoard({
  game,
  canPlay,
  selected,
  onSelect,
}: {
  game: CaroGame;
  canPlay: boolean;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const [focus, setFocus] = useState(Math.floor(game.board.length / 2));
  const [zoom, setZoom] = useState(false);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const last = game.moves[game.moves.length - 1];
  const winning = game.result?.winner ? game.result.line : [];
  function keyboard(event: KeyboardEvent, index: number) {
    const row = Math.floor(index / CARO_SIZE);
    const column = index % CARO_SIZE;
    const next = {
      ArrowUp: row > 0 ? index - CARO_SIZE : index,
      ArrowDown: row < CARO_SIZE - 1 ? index + CARO_SIZE : index,
      ArrowLeft: column > 0 ? index - 1 : index,
      ArrowRight: column < CARO_SIZE - 1 ? index + 1 : index,
      Home: index - column,
      End: index - column + CARO_SIZE - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    cells.current[next]?.focus();
  }
  function toggleZoom() {
    const nextZoom = !zoom;
    setZoom(nextZoom);
    if (nextZoom)
      requestAnimationFrame(() => {
        const element = cells.current[selected ?? last ?? focus];
        const container = scroller.current;
        if (element && container) {
          container.scrollLeft +=
            element.getBoundingClientRect().left -
            container.getBoundingClientRect().left -
            (container.clientWidth - element.clientWidth) / 2;
        }
      });
  }
  return (
    <div className="caro-paper">
      <div className="caro-paper-tools">
        <span>
          {CARO_SIZE} × {CARO_SIZE}
        </span>
        <button
          type="button"
          className="text-button"
          aria-pressed={zoom}
          onClick={toggleZoom}
        >
          {zoom ? "Vừa màn hình" : "Phóng to bàn"}
        </button>
      </div>
      <div
        className={`caro-paper-scroll${zoom ? " zoomed" : ""}`}
        ref={scroller}
      >
        <div
          className="caro-grid"
          role="group"
          aria-label="Bàn cờ Caro, dùng phím mũi tên để di chuyển giữa các ô"
        >
          {game.board.map((mark, index) => {
            const chosen = index === selected;
            const recent = index === last;
            const won = winning.includes(index);
            return (
              <button
                key={index}
                ref={(element) => {
                  cells.current[index] = element;
                }}
                type="button"
                tabIndex={index === focus ? 0 : -1}
                aria-label={`${caroCoordinate(index)} ${mark ?? "trống"}${recent ? ", nước vừa đánh" : ""}${won ? ", nằm trong hàng thắng" : ""}`}
                aria-disabled={!canPlay || mark !== null}
                aria-pressed={chosen}
                className={`caro-cell${recent ? " last" : ""}${won ? " won" : ""}`}
                data-mark={mark ?? (chosen ? game.turn : undefined)}
                onFocus={() => setFocus(index)}
                onKeyDown={(event) => keyboard(event, index)}
                onClick={() => {
                  if (canPlay && mark === null) onSelect(index);
                }}
              >
                <span aria-hidden="true">
                  {mark ?? (chosen ? game.turn : "")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
