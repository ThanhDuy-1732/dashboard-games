import { scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import { createGameServer } from "../src/server.js";

test("admin session requires a valid password and protects logout across origins", async () => {
  const origin = "http://localhost:5173";
  const salt = "0123456789abcdef0123456789abcdef";
  const hash = scryptSync("test-admin", salt, 64).toString("hex");
  const app = await createGameServer({ port: 0, admin: { origin, passwordHash: salt + ":" + hash, secure: false } });
  try {
    const request = (path: string, options?: RequestInit) => fetch(app.url + "/api/admin/" + path, options);
    expect((await request("summary")).status).toBe(401);
    const login = await request("login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test-admin" }),
    });
    expect(login.status).toBe(200);
    expect(login.headers.get("Cache-Control")).toBe("no-store");
    expect(login.headers.get("Set-Cookie")).toContain("HttpOnly");
    const Cookie = login.headers.get("Set-Cookie")!.split(";")[0]!;
    expect((await request("session", { headers: { Cookie } })).status).toBe(200);
    expect((await request("logout", { method: "POST", headers: { Origin: "http://example.com", Cookie } })).status).toBe(403);
    expect((await request("logout", { method: "POST", headers: { Origin: origin, Cookie } })).status).toBe(200);
    expect((await request("session", { headers: { Cookie } })).status).toBe(401);
  } finally {
    await app.close();
  }
});

test("cleanup requires a fresh preview tied to the same admin session", async () => {
  const origin = "http://localhost:5173";
  const salt = "0123456789abcdef0123456789abcdef";
  let removed = 0;
  const app = await createGameServer({
    port: 0,
    admin: { origin, passwordHash: salt + ":" + scryptSync("test-admin", salt, 64).toString("hex"), secure: false },
    metrics: {
      record: async () => ({ accepted: [], expired: [] }),
      preview: async () => ({ count: 1, estimatedBytes: 200 }),
      cleanup: async () => ({ deleted: ++removed, remaining: 0 }),
      cleanupHistory: async () => [],
    },
  });
  const post = (path: string, body: unknown, cookie?: string) => fetch(app.url + "/api/admin/" + path, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const login = async () => (await post("login", { password: "test-admin" })).headers.get("Set-Cookie")!.split(";")[0]!;
  try {
    const a = await login();
    const b = await login();
    const result = await post("cleanup/preview", { kinds: ["view"], before: "2020-01-01T00:00:00.000Z" }, a);
    expect(result.status).toBe(200);
    const { previewToken } = await result.json();
    expect(removed).toBe(0);
    expect((await post("cleanup", { previewToken })).status).toBe(401);
    expect((await post("cleanup", { previewToken }, b)).status).toBe(409);
    expect((await post("cleanup", { previewToken, kinds: ["latency"] }, a)).status).toBe(400);
    expect(await (await post("cleanup", { previewToken }, a)).json()).toEqual({ deleted: 1, remaining: 0 });
    expect((await post("cleanup", { previewToken }, a)).status).toBe(409);
    expect(removed).toBe(1);
  } finally {
    await app.close();
  }
});
