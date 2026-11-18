import { afterEach, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { getPlatform, isNative, onlineServerUrl } from "../src/platform.js";
afterEach(() => vi.restoreAllMocks());
it("detects_real_native_platform_without_enabling_bluetooth_on_web", () => {
  for (const platform of ["web", "ios", "android"] as const) {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue(platform);
    expect(getPlatform()).toBe(platform);
    expect(isNative()).toBe(platform !== "web");
  }
});
it("native_online_requires_configured_https_while_offline_remains_available", () => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
  expect(onlineServerUrl("")).toBeNull();
  expect(onlineServerUrl("http://127.0.0.1:3001")).toBeNull();
  expect(onlineServerUrl("https://games.example.test")).toBe(
    "https://games.example.test",
  );
  expect(isNative()).toBe(true);
});
it("initializes_offline_games_without_newer_webview_clone_or_uuid_methods", async () => {
  const realCrypto = globalThis.crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: realCrypto.getRandomValues.bind(realCrypto),
  });
  vi.stubGlobal("structuredClone", undefined);
  try {
    await import("../src/compat.js");
    expect(crypto.randomUUID()).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
    const { createOfflineSession } = await import("../src/session/offline.js");
    const session = createOfflineSession({
      human: { id: "human", name: "Bạn", kind: "human", token: "car" },
      botCount: 1,
    });
    expect(session.snapshot().players).toHaveLength(2);
    await session.close();
  } finally {
    vi.unstubAllGlobals();
  }
});
