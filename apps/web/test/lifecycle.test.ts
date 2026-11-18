import { afterEach, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import {
  attachPlatformLifecycle,
  attachAndroidBack,
} from "../src/platform-lifecycle.js";
import type { GameSession } from "@nha-choi/protocol";
vi.mock("@capacitor/app", () => ({
  App: { addListener: vi.fn(), exitApp: vi.fn(async () => {}) },
}));
afterEach(() => vi.restoreAllMocks());
it("background_pauses_and_foreground_resyncs_in_order_without_duplicate_events", async () => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
  let callback: (value: { isActive: boolean }) => void = () => {};
  const remove = vi.fn();
  vi.mocked(App.addListener).mockImplementation((_event, listener) => {
    callback = listener as typeof callback;
    return Promise.resolve({ remove });
  });
  const session = {
    setActive: vi.fn(async () => {}),
    send: vi.fn(),
    close: vi.fn(),
    subscribe: vi.fn(),
  } satisfies GameSession;
  const onError = vi.fn();
  const stop = attachPlatformLifecycle(session, { onError });
  callback({ isActive: false });
  callback({ isActive: true });
  await vi.waitFor(() =>
    expect(session.setActive.mock.calls).toEqual([[false], [true]]),
  );
  stop();
  callback({ isActive: true });
  await Promise.resolve();
  expect(session.setActive).toHaveBeenCalledTimes(2);
  await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
  expect(onError).not.toHaveBeenCalled();
});
it("web_registers_no_native_listeners_and_android_back_asks_the_app_before_exiting", async () => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");
  const session = {
    setActive: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    subscribe: vi.fn(),
  } satisfies GameSession;
  vi.mocked(App.addListener).mockClear();
  attachPlatformLifecycle(session, { onError: vi.fn() })();
  expect(App.addListener).not.toHaveBeenCalled();
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
  let callback = () => {};
  vi.mocked(App.addListener).mockImplementation((_event, listener) => {
    callback = listener as () => void;
    return Promise.resolve({ remove: vi.fn() });
  });
  const back = vi.fn(() => true),
    stop = attachAndroidBack(back, vi.fn());
  callback();
  expect(back).toHaveBeenCalledOnce();
  expect(App.exitApp).not.toHaveBeenCalled();
  back.mockReturnValue(false);
  callback();
  expect(App.exitApp).toHaveBeenCalledOnce();
  stop();
});
it("pauses_and_reports_a_native_save_failure_and_removes_listeners_only_once", async () => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
  let callback: (value: { isActive: boolean }) => void = () => {};
  const remove = vi.fn();
  vi.mocked(App.addListener).mockImplementation((_event, listener) => {
    callback = listener as typeof callback;
    return Promise.resolve({ remove });
  });
  const session = {
    setActive: vi.fn(async () => {}),
    send: vi.fn(),
    close: vi.fn(),
    subscribe: vi.fn(),
  } satisfies GameSession;
  const reason = new Error("save failed"),
    onError = vi.fn(),
    stop = attachPlatformLifecycle(session, {
      onActive: async () => {
        throw reason;
      },
      onError,
    });
  callback({ isActive: false });
  await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(reason));
  expect(session.setActive).toHaveBeenCalledWith(false);
  stop();
  stop();
  await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
});
