import { z } from "zod";

const event = z.strictObject({
  id: z.string().min(1).max(128).regex(/^[\w:-]+$/),
  occurredAt: z.iso.datetime(),
});
const maxGameDuration = 30 * 86_400_000;

export function gameDurationMs(start: number | undefined, end: number) {
  if (start === undefined) return undefined;
  const elapsed = end - start;
  return Number.isSafeInteger(elapsed) && elapsed >= 0 && elapsed <= maxGameDuration ? elapsed : undefined;
}

const presence = event.extend({
  sessionId: z.uuid(),
  platform: z.enum(["web", "pwa", "android", "ios"]),
});
export const telemetryEventSchema = z.discriminatedUnion("kind", [
  presence.extend({ kind: z.literal("view"), screen: z.enum(["home", "setup", "caro", "lobby", "game", "results", "kiln", "dino"]) }),
  presence.extend({ kind: z.literal("session_started") }),
  presence.extend({ kind: z.literal("activity") }),
  event.extend({
    kind: z.enum(["game_started", "game_completed"]),
    game: z.enum(["caro", "ty-phu", "kiln", "dino"]),
    mode: z.enum(["online", "offline"]),
    playMode: z.enum(["bot", "same-device", "solo"]).optional(),
    durationMs: z.int().min(0).max(maxGameDuration).optional(),
  }),
  event.extend({
    kind: z.literal("latency"),
    metric: z.enum(["backend", "database", "device"]),
    durationMs: z.number().min(0).max(120_000),
    technicalError: z.boolean(),
  }),
]);
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

type GameEvent = Extract<TelemetryEvent, { kind: "game_started" | "game_completed" }>;
export type TrackedGame = GameEvent["game"];
export type OfflinePlayMode = NonNullable<GameEvent["playMode"]>;
