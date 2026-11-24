import type { CSSProperties } from "react";
import type { FlowerColor } from "@nha-choi/game-core";
const STYLES = ["flower-pink", "flower-yellow", "flower-blue", "flower-purple", "flower-leaf"] as const;
const COUNTS = [8, 12, 5, 5, 7] as const;
export function Flower({ color }: { color: FlowerColor }) {
  const petals = Array.from({ length: COUNTS[color] }, (_, i) => (
    <i key={i} className="petal" style={{ "--p": i } as CSSProperties} />
  ));
  return <span className={`blossom ${STYLES[color]}`} aria-hidden="true">{petals}<span className="inner-corolla">{petals}</span><i className="heart" /></span>;
}
