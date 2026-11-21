import { z } from "zod";

const event = z.strictObject({
  id: z.string().min(1).max(128).regex(/^[\w:-]+$/),
  occurredAt: z.iso.datetime(),
});
const presence = event.extend({
  sessionId: z.uuid(),
  platform: z.enum(["web", "pwa", "android", "ios"]),
});
export const telemetryEventSchema = z.discriminatedUnion("kind", [
  presence.extend({ kind: z.literal("view"), screen: z.enum(["home", "setup", "caro", "lobby", "game", "results"]) }),
  presence.extend({ kind: z.literal("session_started") }),
  presence.extend({ kind: z.literal("activity") }),
  event.extend({
    kind: z.enum(["game_started", "game_completed"]),
    game: z.enum(["caro", "ty-phu"]),
    mode: z.enum(["online", "offline"]),
  }),
  event.extend({
    kind: z.literal("latency"),
    metric: z.enum(["backend", "database", "device"]),
    durationMs: z.number().min(0).max(120_000),
    technicalError: z.boolean(),
  }),
]);
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;
