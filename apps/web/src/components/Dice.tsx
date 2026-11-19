import type { CSSProperties } from "react";

const FACES = [
  { x: 0, y: 0, pips: [5] },
  { x: 0, y: 90, pips: [1, 9] },
  { x: 90, y: 0, pips: [1, 5, 9] },
  { x: -90, y: 0, pips: [1, 3, 7, 9] },
  { x: 0, y: -90, pips: [1, 3, 5, 7, 9] },
  { x: 0, y: 180, pips: [1, 3, 4, 6, 7, 9] },
];

export function Dice({
  result,
  rolling,
}: {
  result: [number, number] | null;
  rolling: boolean;
}) {
  return (
    <div
      className={`center-dice${rolling ? " dice-rolling" : ""}`}
      role="img"
      aria-label={
        result ? `Xúc xắc ${result.join(" và ")}` : "Chưa gieo xúc xắc"
      }
    >
      {(result ?? [1, 1]).map((value, i) => {
        const face = FACES[value - 1]!;
        return (
          <span className="die-scene" key={i} aria-hidden="true">
            <span className="die-shadow" />
            <span
              className="die-cube"
              data-result={value}
              style={
                {
                  "--result-x": `${-face.x}deg`,
                  "--result-y": `${-face.y}deg`,
                } as CSSProperties
              }
            >
              {FACES.map(({ x, y, pips }, index) => (
                <span
                  className="die-face"
                  data-face={index + 1}
                  key={index}
                  style={{
                    transform: `rotateX(${x}deg) rotateY(${y}deg) translateZ(calc(var(--die-size) / 2))`,
                  }}
                >
                  {pips.map((pip) => (
                    <span
                      className="die-pip"
                      key={pip}
                      style={{
                        gridRow: Math.ceil(pip / 3),
                        gridColumn: ((pip - 1) % 3) + 1,
                      }}
                    />
                  ))}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}
