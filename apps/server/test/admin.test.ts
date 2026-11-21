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
