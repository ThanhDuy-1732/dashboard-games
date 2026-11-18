import { App } from "@capacitor/app";
import type { GameSession } from "@nha-choi/protocol";
import { getPlatform, isNative } from "./platform.js";
export function attachPlatformLifecycle(
  session: GameSession,
  {
    onActive = (active: boolean) => session.setActive(active),
    onError,
  }: {
    onActive?: (active: boolean) => Promise<void>;
    onError: (reason: unknown) => void;
  },
): () => void {
  if (!isNative()) return () => {};
  let stopped = false,
    queue = Promise.resolve();
  const handle = App.addListener("appStateChange", ({ isActive }) => {
    if (stopped) return;
    queue = queue
      .then(async () => {
        if (!stopped) await onActive(isActive);
      })
      .catch((reason) => {
        void session.setActive(false).catch(onError);
        onError(reason);
      });
  });
  void handle.catch(onError);
  return () => {
    if (stopped) return;
    stopped = true;
    void handle.then((listener) => listener.remove()).catch(onError);
  };
}
export function attachAndroidBack(
  onBack: () => boolean,
  onError: (reason: unknown) => void,
): () => void {
  if (getPlatform() !== "android") return () => {};
  let stopped = false;
  const handle = App.addListener("backButton", () => {
    if (stopped) return;
    const dialogs =
      typeof document === "undefined"
        ? null
        : document.querySelectorAll<HTMLDialogElement>("dialog[open]");
    const dialog = dialogs?.item(dialogs.length - 1);
    if (dialog) {
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
      return;
    }
    if (!onBack()) void App.exitApp().catch(onError);
  });
  void handle.catch(onError);
  return () => {
    if (stopped) return;
    stopped = true;
    void handle.then((listener) => listener.remove()).catch(onError);
  };
}
