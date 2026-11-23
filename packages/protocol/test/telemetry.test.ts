import { expect, test } from "vitest";
import { gameDurationMs, telemetryEventSchema } from "../src/telemetry.js";

test("accepts solo game duration and does not invent a duration for legacy or out-of-order clocks", () => {
  const event = {
    id: "fixture", occurredAt: "2026-11-23T00:00:00Z", kind: "game_completed",
    game: "kiln", mode: "offline", playMode: "solo", durationMs: gameDurationMs(1000, 11_000),
  };
  expect(telemetryEventSchema.parse(event).durationMs).toBe(10_000);
  expect(gameDurationMs(undefined, 11_000)).toBeUndefined();
  expect(gameDurationMs(12_000, 11_000)).toBeUndefined();
  expect(telemetryEventSchema.safeParse({ ...event, durationMs: -1 }).success).toBe(false);
});
