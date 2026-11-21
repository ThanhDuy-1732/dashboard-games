import { expect, test, vi } from "vitest";
import { createGameServer } from "../src/server.js";

test("accepts offline milestones but rejects device requests with server-only metrics", async () => {
  const record = vi.fn().mockResolvedValue({ accepted: ["fixture"], expired: [] });
  const app = await createGameServer({ port: 0, metrics: { record } });
  const request = (mode: string) => fetch(app.url + "/api/telemetry", {
    method: "POST",
    headers: { Origin: "http://localhost:5173", "Content-Type": "application/json" },
    body: JSON.stringify({ events: [{
      id: "fixture", occurredAt: new Date().toISOString(), kind: "game_started", game: "caro", mode,
    }] }),
  });
  try {
    expect((await request("online")).status).toBe(400);
    expect(await (await request("offline")).json()).toEqual({ accepted: ["fixture"], expired: [] });
    expect(record).toHaveBeenCalledTimes(1);
  } finally {
    await app.close();
  }
});
