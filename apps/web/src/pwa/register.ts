interface Options {
  isNative: boolean;
  inGame: () => boolean;
  onOfflineReady: () => void;
  onUpdateReady: () => void;
  onError?: (error: unknown) => void;
}
export async function registerPwa(options: Options) {
  let registration: ServiceWorkerRegistration | undefined,
    accepted = false,
    opening = true;
  let updateTimer: ReturnType<typeof setInterval> | undefined;
  const controllerChange = () => {
    if (accepted) location.reload();
  };
  const checkForUpdate = () => {
    if (
      globalThis.document?.visibilityState === "visible" &&
      registration?.active &&
      !registration.waiting &&
      !registration.installing
    )
      return registration.update().catch(() => {});
  };
  const result = {
    update() {
      if (options.inGame() || !registration?.waiting) return false;
      accepted = true;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return true;
    },
    dispose() {
      clearInterval(updateTimer);
      globalThis.document?.removeEventListener("visibilitychange", checkForUpdate);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        controllerChange,
      );
    },
  };
  if (options.isNative || !("serviceWorker" in navigator)) return result;
  const updateReady = () => {
    const apply =
      opening &&
      globalThis.document?.visibilityState === "visible" &&
      navigator.serviceWorker.controller;
    opening = false;
    if (!apply || !result.update()) options.onUpdateReady();
  };
  try {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChange,
    );
    registration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });
    if (registration.waiting) updateReady();
    if (registration.active?.state === "activated") options.onOfflineReady();
    const watch = () => {
      const worker = registration?.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && registration?.active)
          updateReady();
        if (worker.state === "activated") options.onOfflineReady();
        if (worker.state === "redundant") {
          opening = false;
          options.onError?.(new Error("Chưa tải đủ dữ liệu để chơi offline."));
        }
      });
    };
    watch();
    registration.addEventListener("updatefound", watch);
    if (globalThis.document) {
      document.addEventListener("visibilitychange", checkForUpdate);
      updateTimer = setInterval(checkForUpdate, 60_000);
      if (!registration.active || document.visibilityState !== "visible") {
        opening = false;
      }
      void checkForUpdate()?.finally(() => {
        if (!registration?.installing && !registration?.waiting) opening = false;
      });
    }
  } catch (error) {
    options.onError?.(error);
  }
  return result;
}
