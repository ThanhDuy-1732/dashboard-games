import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FLOWER_NAMES, flowerAdjacent, isFlowerLock } from "@nha-choi/game-core";
import type { FlowerCell, FlowerFrame } from "@nha-choi/game-core";
import { Flower } from "./Flower.js";
export interface FlowerExchange { a: number; b: number; back: boolean }
export function flowerDragTarget(index: number, dx: number, dy: number, size: number): number | null {
  const major = Math.max(Math.abs(dx), Math.abs(dy)), minor = Math.min(Math.abs(dx), Math.abs(dy));
  if (size <= 0 || major <= size * .25 || major > size * 1.5 || minor > size * .45 || minor > major * .5) return null;
  const next = index + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : (dy > 0 ? 7 : -7));
  return flowerAdjacent(index, next) ? next : null;
}
export function FlowerBoard({ board, grass, frame, exchange, selected, hint, disabled, tool, onSelect, onSwap, onCancel }: {
  board: FlowerCell[]; grass: number[]; frame: FlowerFrame | null; exchange: FlowerExchange | null;
  selected: number | null; hint: number[]; disabled: boolean; tool: boolean;
  onSelect: (index: number) => void; onSwap: (a: number, b: number) => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const gesture = useRef<{ index: number; x: number; y: number; pointer: number } | null>(null);
  const [drag, setDrag] = useState<{ index: number; x: number; y: number; target: number | null } | null>(null);
  useEffect(() => {
    const cancel = () => { gesture.current = null; setDrag(null); onCancel(); };
    document.addEventListener("visibilitychange", cancel);
    window.addEventListener("blur", cancel);
    return () => { document.removeEventListener("visibilitychange", cancel); window.removeEventListener("blur", cancel); };
  }, [onCancel]);
  useLayoutEffect(() => {
    if (!exchange) return;
    const a = buttons.current[exchange.a]!, b = buttons.current[exchange.b]!;
    const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
    for (const [el, direction] of [[a, 1], [b, -1]] as const) {
      el.style.setProperty("--swap-x", `${(br.left - ar.left) * direction}px`);
      el.style.setProperty("--swap-y", `${(br.top - ar.top) * direction}px`);
    }
  }, [exchange]);
  return <div className="flower-board" ref={ref} role="group" aria-label="Bàn hoa 7 × 7" aria-busy={Boolean(frame || exchange)}
    onPointerDown={event => {
      if (disabled || event.button !== 0 || event.isPrimary === false || gesture.current) return;
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-flower-cell]");
      if (!target) return;
      const index = Number(target.dataset.flowerCell);
      if (board[index]!.obstacle && !tool) return;
      event.preventDefault(); target.focus({ preventScroll: true });
      gesture.current = { index, x: event.clientX, y: event.clientY, pointer: event.pointerId };
      if (!tool) setDrag({ index, x: 0, y: 0, target: null });
      ref.current?.setPointerCapture?.(event.pointerId);
    }}
    onPointerMove={event => {
      const g = gesture.current; if (!g || event.pointerId !== g.pointer || tool) return;
      const dx = event.clientX - g.x, dy = event.clientY - g.y;
      const size = buttons.current[g.index]!.getBoundingClientRect().width;
      const next = flowerDragTarget(g.index, dx, dy, size);
      setDrag({ index: g.index, x: Math.max(-size, Math.min(size, dx)), y: Math.max(-size, Math.min(size, dy)),
        target: next !== null && !board[next]!.obstacle ? next : null });
    }}
    onPointerUp={event => {
      const g = gesture.current; if (!g || event.pointerId !== g.pointer) return;
      gesture.current = null; setDrag(null);
      if (ref.current?.hasPointerCapture?.(event.pointerId)) ref.current.releasePointerCapture(event.pointerId);
      const dx = event.clientX - g.x, dy = event.clientY - g.y, size = buttons.current[g.index]!.getBoundingClientRect().width;
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= size * .25) onSelect(g.index);
      else if (tool) onCancel();
      else {
        const next = flowerDragTarget(g.index, dx, dy, size);
        if (next !== null && !board[next]!.obstacle) onSwap(g.index, next);
        else onCancel();
      }
    }}
    onPointerCancel={() => { gesture.current = null; setDrag(null); onCancel(); }}
    onLostPointerCapture={() => { gesture.current = null; setDrag(null); }}
    onKeyDown={event => {
      const index = Number((event.target as HTMLElement).closest<HTMLElement>("[data-flower-cell]")?.dataset.flowerCell);
      if (event.key === "Escape") { gesture.current = null; setDrag(null); onCancel(); return; }
      const directions: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
      const delta = directions[event.key];
      if (delta === undefined || !Number.isInteger(index)) return;
      event.preventDefault(); const next = index + delta;
      if (!flowerAdjacent(index, next)) return;
      if (event.shiftKey && !disabled) onSwap(index, next);
      else buttons.current[next]?.focus();
    }}>
    {board.map((cell, index) => {
      const bursting = frame?.kind === "burst" && frame.indices.includes(index);
      const unlocking = frame?.kind === "unlock" && frame.indices.includes(index);
      const lock = isFlowerLock(cell.obstacle);
      const obstacleLabel = cell.obstacle ? lock ? `khóa ${cell.obstacle.kind === "turn-lock" ? "theo lượt" : "theo nổ"}, còn ${cell.obstacle.hp} ${cell.obstacle.kind === "turn-lock" ? "lượt" : "đợt nổ sát cạnh"}, ${FLOWER_NAMES[cell.color]}` : `${cell.obstacle.kind === "rock" ? "đá" : "nụ lớn"}, ${cell.obstacle.hp} sức bền` : FLOWER_NAMES[cell.color];
      const dropping = frame?.kind === "fall" && frame.drops[index];
      const swapping = exchange && (exchange.a === index || exchange.b === index);
      const style = { "--drag-x": `${drag?.x ?? 0}px`, "--drag-y": `${drag?.y ?? 0}px`, "--fall-from": `${-(dropping || 0) * 105}%` } as CSSProperties;
      return <button key={index} type="button" ref={el => { buttons.current[index] = el; }}
        className={`flower-cell${selected === index ? " chosen" : ""}${hint.includes(index) ? " guide" : ""}${drag?.index === index ? " is-dragging" : ""}${drag?.target === index ? " drop-target" : ""}${bursting ? " bursting" : ""}${unlocking ? " is-unlocking" : ""}${dropping ? " drop-in" : ""}${swapping ? exchange.back ? " swap-back" : " swapping" : ""}`}
        style={style} data-flower-cell={index} data-color={cell.obstacle ? "blocked" : cell.color}
        aria-pressed={selected === index} aria-disabled={disabled || lock || (!tool && Boolean(cell.obstacle))}
        aria-label={`Hàng ${Math.floor(index / 7) + 1}, cột ${index % 7 + 1}, ${obstacleLabel}${grass.includes(index) ? ", có cỏ" : ""}`}
        onClick={event => { if (event.detail === 0 && !disabled) onSelect(index); }}>
        {grass.includes(index) && <span className="grass-bed" aria-hidden="true" />}
        {lock ? <span className={`flower-lock ${cell.obstacle!.kind}`} aria-hidden="true"><span className="locked-flower"><Flower color={cell.color} /></span><i className="lock-shackle" /><span className="lock-body"><span>{cell.obstacle!.kind === "turn-lock" ? "◷" : "✦"}</span><strong>{cell.obstacle!.hp}</strong></span></span> : cell.obstacle ? <span className={`flower-obstacle ${cell.obstacle.kind}`} aria-hidden="true"><span /> <small>{cell.obstacle.hp}</small></span> : <Flower color={cell.color} />}
        {bursting && <><span className="bloom-ripple" aria-hidden="true" />{Array.from({ length: 6 }, (_, p) => <i key={p} className="pollen" aria-hidden="true" style={{ "--tx": `${Math.cos(p * Math.PI / 3) * 60}px`, "--ty": `${Math.sin(p * Math.PI / 3) * 60 - 15}px` } as CSSProperties} />)}</>}</button>;
    })}
  </div>;
}
