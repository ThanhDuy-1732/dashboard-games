import "fake-indexeddb/auto";
import { expect, test, vi } from "vitest";
import { enqueueTelemetry, flushTelemetry } from "../src/telemetry.js";

test("retains a batch when the connection drops and only removes acknowledged events", async () => {
  const fetch = vi.fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(new Response(JSON.stringify({ accepted: ["test-1"], expired: [] }), {
      headers: { "Content-Type": "application/json" },
    }));
  vi.stubGlobal("fetch", fetch);
  try {
    await enqueueTelemetry({ id: "test-1", occurredAt: new Date().toISOString(), kind: "game_completed", game: "caro", mode: "offline" });
    await flushTelemetry();
    await flushTelemetry();
    await flushTelemetry();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]?.[1].body).toEqual(fetch.mock.calls[1]?.[1].body);
  } finally {
    vi.unstubAllGlobals();
  }
});
