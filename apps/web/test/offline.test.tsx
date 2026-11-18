import { expect, it, vi } from "vitest";
import { createOfflineSession } from "../src/session/offline.js";
import type { SessionUpdate } from "@nha-choi/protocol";
it("creates_1_to_5_bots_and_stops_scheduling_when_closed", async () => {
  vi.useFakeTimers();
  try {
    const session = createOfflineSession({
      human: { id: "human", name: "Bạn", token: "car", kind: "human" },
      botCount: 5,
    });
    let update: SessionUpdate | null = null;
    session.subscribe((next) => {
      update = next;
    });
    expect((update as SessionUpdate | null)?.view?.players).toHaveLength(6);
    expect(
      new Set(
        (update as SessionUpdate | null)?.view?.players.map((p) => p.token),
      ).size,
    ).toBe(6);
    await session.close();
    await vi.runAllTimersAsync();
    expect((update as SessionUpdate | null)?.connection).toBe("closed");
    expect(() =>
      createOfflineSession({
        human: { id: "human", name: "Bạn", token: "car", kind: "human" },
        botCount: 6,
      }),
    ).toThrow();
  } finally {
    vi.useRealTimers();
  }
});
