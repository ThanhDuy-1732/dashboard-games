interface Options {
  isNative: boolean;
  inGame: () => boolean;
  onOfflineReady: () => void;
  onUpdateReady: () => void;
  onError?: (error: unknown) => void;
}
export async function registerPwa(options: Options) {
  let registration: ServiceWorkerRegistration | undefined,
    accepted = false;
  let updateTimer: ReturnType<typeof setInterval> | undefined;
  const controllerChange = () => {
    if (accepted) location.reload();
  };
  const checkForUpdate = () => {
    if (
      document.visibilityState === "visible" &&
      registration?.active &&
      !registration.waiting &&
      !registration.installing
    )
      void registration.update().catch(() => {});
  };
  const result = {
    async update() {
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
  try {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChange,
    );
    registration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });
    if (registration.waiting) options.onUpdateReady();
    if (registration.active?.state === "activated") options.onOfflineReady();
    const watch = () => {
      const worker = registration?.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && registration?.active)
          options.onUpdateReady();
        if (worker.state === "activated") options.onOfflineReady();
        if (worker.state === "redundant")
          options.onError?.(new Error("Chưa tải đủ dữ liệu để chơi offline."));
      });
    };
    watch();
    registration.addEventListener("updatefound", watch);
    if (globalThis.document) {
      document.addEventListener("visibilitychange", checkForUpdate);
      updateTimer = setInterval(checkForUpdate, 60_000);
      checkForUpdate();
    }
  } catch (error) {
    options.onError?.(error);
  }
  return result;
}
