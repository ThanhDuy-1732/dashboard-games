import { trackGame } from "../telemetry.js";
import { App as CapacitorApp } from "@capacitor/app";
import { createDinoRun, DINO_FALL_WARNING_M, DINO_PIT_REVEAL_M, DINO_STEP_SECONDS, stepDinoRun } from "@nha-choi/game-core";
import type { DinoLane, DinoMap, DinoRun } from "@nha-choi/game-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { isNative } from "../platform.js";
import { createDinoScene } from "./scene.js";
import type { DinoScene, DinoView } from "./scene.js";
import { readDinoBest, saveDinoBest } from "./save.js";
import { DINO_MAP_IDS, DINO_MAPS } from "./maps.js";
import { DINO_FORM_IDS, DINO_FORMS, DINO_RUNNER_IDS, DINO_RUNNERS } from "./runners.js";
import type { DinoRunner } from "./runners.js";
import "./dino.css";

type Phase = "ready" | "running" | "paused" | "finished" | "unavailable";
const itemLabels = { "speed-up": "Tăng tốc", "slow-down": "Giảm tốc" } as const;
const laneLabels = { "-1": "làn trái", 0: "làn giữa", 1: "làn phải" };

function dangerLabel(run: DinoRun): string {
  const hazard = run.obstacles.find(({ kind, startM, broken }) => {
    const remaining = startM - run.distanceM;
    return !broken && remaining >= 0 &&
      ((kind === "falling-rock" && remaining <= DINO_FALL_WARNING_M) ||
        (kind === "pit" && remaining <= DINO_PIT_REVEAL_M));
  });
  return hazard ? `${hazard.kind === "pit" ? "Hố mở" : "Đá rơi"} · ${laneLabels[hazard.lane ?? 0]}` : "";
}

function effectHud(run: DinoRun) {
  return {
    speed: run.speedEffect?.kind ?? null,
    paceSeconds: Math.ceil((run.speedEffect?.ticksLeft ?? 0) * DINO_STEP_SECONDS),
    evolution: run.evolution?.kind ?? null,
    evolutionSeconds: Math.ceil((run.evolution?.ticksLeft ?? 0) * DINO_STEP_SECONDS),
  };
}

function armorHud(run: DinoRun) {
  if (run.hasArmor) return "ready";
  if (run.armorFlashTicks > 0) return "absorbed";
  return null;
}

function localBest(map: DinoMap) {
  try {
    return readDinoBest(window.localStorage, map);
  } catch {
    return 0;
  }
}

export function DinoScreen({
  onBack,
  onInGameChange,
}: {
  onBack: () => void;
  onInGameChange: (active: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const run = useRef(createDinoRun(0));
  const telemetry = useRef<{ id: string; startedAt: number } | null>(null);
  const wantsJump = useRef(false);
  const wantsFire = useRef(false);
  const moves = useRef<Array<-1 | 1>>([]);
  const [phase, setPhase] = useState<Phase>("ready");
  const mode = useRef<Phase>("ready");
  const clock = useRef({ previous: undefined as number | undefined, owed: 0 });
  const [view, setView] = useState<DinoView>("third");
  const camera = useRef<DinoView>("third");
  const [distance, setDistance] = useState(0);
  const [airborne, setAirborne] = useState(false);
  const [lane, setLane] = useState<DinoLane>(0);
  const [effects, setEffects] = useState(() => effectHud(run.current));
  const [fireReady, setFireReady] = useState(false);
  const [armor, setArmor] = useState<ReturnType<typeof armorHud>>(null);
  const [danger, setDanger] = useState("");
  const [map, setMap] = useState<DinoMap>("volcano");
  const [runner, setRunner] = useState<DinoRunner>("lizard");
  const [best, setBest] = useState(() => localBest("volcano"));
  const [webglMessage, setWebglMessage] = useState("Thiết bị này cần hỗ trợ WebGL 2 để hiển thị game.");

  const changePhase = useCallback((next: Phase) => {
    mode.current = next;
    clock.current.previous = undefined;
    clock.current.owed = 0;
    wantsJump.current = false;
    wantsFire.current = false;
    moves.current.length = 0;
    setPhase(next);
    onInGameChange(next === "running" || next === "paused");
  }, [onInGameChange]);

  const toggleView = useCallback(() => {
    if (mode.current !== "running") return;
    const next = camera.current === "first" ? "third" : "first";
    camera.current = next;
    setView(next);
  }, []);

  function start() {
    const id = crypto.randomUUID();
    telemetry.current = { id, startedAt: Date.now() };
    trackGame("dino", id, "game_started", "solo");
    run.current = createDinoRun(Math.floor(Math.random() * 0x100000000), map);
    setDistance(0);
    setAirborne(false);
    setLane(0);
    setEffects(effectHud(run.current));
    setFireReady(false);
    setArmor(null);
    setDanger("");
    changePhase("running");
  }

  function chooseMap(next: DinoMap) {
    if (next !== map) setBest(localBest(next));
    run.current = createDinoRun(0, next);
    setMap(next);
    changePhase("ready");
  }

  useEffect(() => {
    if (phase === "running") stage.current?.focus();
    else primary.current?.focus();
  }, [phase]);

  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    let scene: DinoScene;
    try {
      scene = createDinoScene(surface, map, runner);
    } catch {
      changePhase("unavailable");
      return;
    }

    let stopped = false;
    let frameId = 0;
    let lastRun = run.current;
    let lastView = camera.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastReducedMotion = motion.matches;

    function pause() {
      if (mode.current !== "running") return;
      changePhase("paused");
    }

    function animate(now: number) {
      if (stopped) return;
      if (mode.current === "running") {
        const time = clock.current;
        if (time.previous !== undefined) time.owed += Math.min((now - time.previous) / 1000, 0.1);
        time.previous = now;
        const before = run.current;
        while (time.owed >= DINO_STEP_SECONDS && run.current.status === "running") {
          run.current = stepDinoRun(run.current, wantsJump.current, moves.current.shift(), wantsFire.current);
          wantsJump.current = false;
          wantsFire.current = false;
          time.owed -= DINO_STEP_SECONDS;
        }
        const next = run.current;
        const meters = Math.floor(next.distanceM);
        if (meters !== Math.floor(before.distanceM)) setDistance(meters);
        if ((next.heightM > 0) !== (before.heightM > 0)) setAirborne(next.heightM > 0);
        if (next.lane !== before.lane) setLane(next.lane);
        if (next.hasFire !== before.hasFire) setFireReady(next.hasFire);
        if (armorHud(next) !== armorHud(before)) setArmor(armorHud(next));
        if (next !== before) {
          const warning = dangerLabel(next);
          if (warning !== dangerLabel(before)) setDanger(warning);
        }
        if (next.speedEffect !== before.speedEffect || next.evolution !== before.evolution) {
          const previous = effectHud(before);
          const current = effectHud(next);
          if (previous.speed !== current.speed || previous.paceSeconds !== current.paceSeconds ||
            previous.evolution !== current.evolution || previous.evolutionSeconds !== current.evolutionSeconds) setEffects(current);
        }
        if (next.status === "crashed") {
          const recorded = telemetry.current;
          if (recorded) trackGame("dino", recorded.id, "game_completed", "solo", recorded.startedAt);
          telemetry.current = null;
          let record = meters;
          try {
            record = saveDinoBest(window.localStorage, meters, next.map);
          } catch {
            // Storage can be disabled for this origin.
          }
          setBest((current) => Math.max(current, record));
          changePhase("finished");
        }
      }
      if (lastRun !== run.current || lastView !== camera.current || lastReducedMotion !== motion.matches) {
        lastRun = run.current;
        lastView = camera.current;
        lastReducedMotion = motion.matches;
        scene.render(lastRun, lastView, lastReducedMotion);
      }
      frameId = requestAnimationFrame(animate);
    }

    function keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (mode.current !== "running") return;
      if (event.code === "Escape") {
        event.preventDefault();
        pause();
      } else if (event.code === "KeyV") {
        toggleView();
      } else if (event.code === "KeyF") {
        event.preventDefault();
        if (run.current.hasFire) wantsFire.current = true;
      } else if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(event.code)) {
        event.preventDefault();
        if (moves.current.length < 2) moves.current.push(event.code === "ArrowLeft" || event.code === "KeyA" ? -1 : 1);
      } else if (event.code === "Space" &&
        !(event.target instanceof Element && event.target.closest("button, a, input, select, textarea, [contenteditable]"))) {
        event.preventDefault();
        wantsJump.current = true;
      }
    }

    function visibility() {
      if (document.hidden) pause();
    }

    function contextLost(event: Event) {
      event.preventDefault();
      cancelAnimationFrame(frameId);
      setWebglMessage("Kết nối đồ họa đã bị gián đoạn. Hãy mở lại game để chơi tiếp.");
      changePhase("unavailable");
    }

    scene.render(lastRun, lastView, lastReducedMotion);
    frameId = requestAnimationFrame(animate);
    document.addEventListener("keydown", keydown);
    document.addEventListener("visibilitychange", visibility);
    surface.addEventListener("webglcontextlost", contextLost);
    const nativeListener = isNative()
      ? CapacitorApp.addListener("appStateChange", ({ isActive }) => {
          if (!stopped && !isActive) pause();
        }).catch(() => undefined)
      : undefined;

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("visibilitychange", visibility);
      surface.removeEventListener("webglcontextlost", contextLost);
      void nativeListener?.then((listener) => listener?.remove()).catch(() => undefined);
      scene.dispose();
      onInGameChange(false);
    };
  }, [changePhase, map, onInGameChange, runner, toggleView]);

  const running = phase === "running";
  return (
    <section
      className="dino-stage"
      aria-label="Thằn Lằn Núi Lửa"
      ref={stage}
      tabIndex={-1}
      data-phase={phase}
      data-map={map}
      data-runner={runner}
      data-evolution={effects.evolution ?? undefined}
      data-view={view}
      data-airborne={airborne}
      data-lane={lane}
      data-armor={armor ?? undefined}
    >
      <canvas className="dino-canvas" ref={canvas} aria-hidden="true" />
      {(running || phase === "paused") && (
        <div className="dino-hud">
          <div className="dino-score">
            <span className="dino-map-label">{DINO_MAPS[map].title}</span>
            <strong aria-label="Quãng đường">{distance} m</strong>
            <span>Kỷ lục {best} m</span>
          </div>
          <div className="dino-effects" aria-label="Hiệu ứng đang hoạt động">
            {effects.speed && (
              <div className="dino-effect" data-kind={effects.speed}>
                <span>{itemLabels[effects.speed]}</span><span>{effects.paceSeconds} s</span>
              </div>
            )}
            {effects.evolution && (
              <div className="dino-effect" data-kind={effects.evolution}>
                <span>{DINO_FORMS[effects.evolution].title}</span><span>{effects.evolutionSeconds} s</span>
              </div>
            )}
            {armor && (
              <div className="dino-effect" data-kind="armor" role="status">
                {armor === "ready" ? "Giáp · Chặn 1 va chạm" : "Giáp đã chặn va chạm"}
              </div>
            )}
            {danger && <div className="dino-effect dino-danger" role="status">{danger}</div>}
          </div>
        </div>
      )}
      {running ? (
        <>
          <div className="dino-tools">
            <button
              className="dino-icon"
              aria-label="Đổi góc nhìn"
              aria-keyshortcuts="V"
              title={view === "third" ? "Góc nhìn thứ ba · V để đổi" : "Góc nhìn thứ nhất · V để đổi"}
              onClick={(event) => {
                toggleView();
                if (event.detail > 0) stage.current?.focus();
              }}
            >
              <span className="dino-camera-icon" aria-hidden="true" />
            </button>
            <button className="dino-icon" aria-label="Tạm dừng" title="Tạm dừng" onClick={() => changePhase("paused")}>
              <span className="dino-pause-icon" aria-hidden="true" />
            </button>
          </div>
          <div className="dino-steering" role="group" aria-label="Chuyển làn">
            {([-1, 1] as const).map((direction) => (
              <button
                key={direction}
                className="dino-icon"
                aria-label={direction === -1 ? "Sang trái" : "Sang phải"}
                onClick={(event) => {
                  if (moves.current.length < 2) moves.current.push(direction);
                  if (event.detail > 0) stage.current?.focus();
                }}
              >
                <span aria-hidden="true">{direction === -1 ? "←" : "→"}</span>
              </button>
            ))}
          </div>
          <div className="dino-run-actions">
            <button
              className="dino-fire"
              aria-label="Phun lửa"
              aria-keyshortcuts="F"
              aria-disabled={!fireReady}
              onClick={(event) => {
                if (run.current.hasFire) wantsFire.current = true;
                if (event.detail > 0) stage.current?.focus();
              }}
            >
              <span>Phun lửa</span>
              {fireReady ? <><small>1 lần</small><kbd>F</kbd></> : <small>Chưa nhặt</small>}
            </button>
            <button
              className="dino-jump dino-action"
              onClick={(event) => {
                wantsJump.current = true;
                if (event.detail > 0) stage.current?.focus();
              }}
            >
              Nhảy
            </button>
          </div>
        </>
      ) : (
        <div className={phase === "ready" ? "dino-overlay dino-welcome" : "dino-overlay"}>
          <div className="dino-panel">
            {phase === "ready" && (
              <>
                <h1>Thằn Lằn<br /> Núi Lửa</h1>
                <fieldset className="dino-picker">
                  <legend>Bản đồ</legend>
                  <div>
                    {DINO_MAP_IDS.map((id) => (
                      <label key={id} data-course={id}>
                        <input type="radio" name="dino-map" checked={map === id} onChange={() => chooseMap(id)} />
                        <span>{DINO_MAPS[id].title}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="dino-picker">
                  <legend>Nhân vật</legend>
                  <div>
                    {DINO_RUNNER_IDS.map((id) => (
                      <label key={id} data-runner-option={id}>
                        <input type="radio" name="dino-runner" checked={runner === id} onChange={() => setRunner(id)} />
                        <span>{DINO_RUNNERS[id].title}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
            {phase === "paused" && <h1>Tạm dừng</h1>}
            {phase === "finished" && (
              <>
                <h1>Kết thúc lượt</h1>
                <p>{DINO_MAPS[map].title}</p>
                <dl className="dino-results">
                  <div><dt>Quãng đường</dt><dd>{distance} m</dd></div>
                  <div><dt>Kỷ lục</dt><dd>{best} m</dd></div>
                </dl>
              </>
            )}
            {phase === "unavailable" && (
              <>
                <h1>Không mở được cảnh 3D</h1>
                <p role="status">{webglMessage}</p>
              </>
            )}
            <div className="dino-actions">
              {phase !== "unavailable" && (
                <button
                  className="dino-action"
                  ref={primary}
                  onClick={phase === "paused" ? () => changePhase("running") : start}
                >
                  {phase === "ready" ? "Chơi" : phase === "paused" ? "Tiếp tục" : "Chơi lại"}
                </button>
              )}
              {phase === "finished" && <button className="dino-back" onClick={() => chooseMap(map)}>Đổi bản đồ</button>}
              <button className="dino-back" ref={phase === "unavailable" ? primary : undefined} onClick={onBack}>Về Nhà Chơi</button>
            </div>
            {phase === "ready" && (
              <details className="dino-guide">
                <summary>Cách chơi và tiến hóa</summary>
                <p>Nhặt lửa để phá đá. Nhảy qua khe và thân cây đổ. Khi có báo đá rơi hoặc hố mở, đổi sang làn an toàn.</p>
                <p className="dino-hint">
                  <span><kbd>←</kbd><kbd>→</kbd> Đổi làn</span>
                  <span><kbd>Space</kbd> Nhảy</span>
                  <span><kbd>F</kbd> Phun lửa</span>
                  <span><kbd>V</kbd> Đổi góc nhìn</span>
                </p>
                <p className="dino-touch-hint">Dùng hai mũi tên để đổi làn.</p>
                <ul className="dino-item-legend">
                  <li data-kind="fire">Phun lửa · 1 lần</li>
                  <li data-kind="armor">Giáp · Chặn 1 va chạm</li>
                  <li data-kind="speed-up">Tăng tốc</li>
                  <li data-kind="slow-down">Giảm tốc</li>
                </ul>
                <ul className="dino-item-legend">
                  {DINO_FORM_IDS.map((kind) => (
                    <li key={kind} data-kind={kind}>{DINO_FORMS[kind].title} · {DINO_FORMS[kind].detail}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
