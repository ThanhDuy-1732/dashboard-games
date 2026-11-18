import { afterEach, expect, it, vi } from "vitest";
import { registerPwa } from "../src/pwa/register.js";
afterEach(() => vi.unstubAllGlobals());
it("never_registers_on_native_and_only_activates_an_update_outside_a_game", async () => {
  let game = true;
  const worker = { postMessage: vi.fn() };
  const registration = {
    active: { state: "activated" },
    waiting: worker,
    installing: null,
    addEventListener: vi.fn(),
  };
  const serviceWorker = {
    register: vi.fn(async () => registration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("navigator", { serviceWorker });
  const ready = vi.fn(),
    refresh = vi.fn();
  await registerPwa({
    isNative: true,
    inGame: () => game,
    onOfflineReady: ready,
    onUpdateReady: refresh,
  });
  expect(serviceWorker.register).not.toHaveBeenCalled();
  const result = await registerPwa({
    isNative: false,
    inGame: () => game,
    onOfflineReady: ready,
    onUpdateReady: refresh,
  });
  expect(refresh).toHaveBeenCalledOnce();
  expect(await result.update()).toBe(false);
  expect(worker.postMessage).not.toHaveBeenCalled();
  game = false;
  expect(await result.update()).toBe(true);
  expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
});
it("reports_incomplete_cache_without_claiming_offline_readiness", async () => {
  const ready = vi.fn(),
    error = vi.fn();
  let changed = () => {};
  const worker = {
    state: "installing",
    addEventListener: vi.fn((_event: string, fn: () => void) => {
      changed = fn;
    }),
  };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: vi.fn(async () => ({
        installing: worker,
        active: null,
        waiting: null,
        addEventListener: vi.fn(),
      })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  await registerPwa({
    isNative: false,
    inGame: () => false,
    onOfflineReady: ready,
    onUpdateReady: vi.fn(),
    onError: error,
  });
  expect(ready).not.toHaveBeenCalled();
  worker.state = "redundant";
  changed();
  expect(error).toHaveBeenCalledOnce();
  expect(ready).not.toHaveBeenCalled();
});
