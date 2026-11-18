import { useEffect, useRef, useState } from "react";
import type { OfflineSession } from "../session/offline.js";
import { createSaveStore, SaveError } from "./save.js";
import { makeSavedGame } from "./save-schema.js";
import type { SavedGame } from "./save-schema.js";
export function saveErrorMessage(error: unknown): string {
  if (error instanceof SaveError) {
    if (error.code === "LEASE_LOST")
      return "Ván đang được mở ở tab khác. Nếu tab đó đã đóng, hãy thử lại sau vài giây.";
    if (error.code === "INCOMPATIBLE")
      return "Bản lưu thuộc phiên bản khác. Dữ liệu được giữ nguyên; hãy cập nhật ứng dụng để tiếp tục.";
    if (error.code === "CORRUPT")
      return "Không đọc được bản lưu. Dữ liệu cũ được giữ nguyên.";
    if (error.code === "SAVE_EXISTS")
      return "Đã có một ván đang lưu. Hãy xác nhận trước khi thay bằng ván mới.";
  }
  return "Chưa lưu được ván. Kiểm tra dung lượng và quyền lưu dữ liệu của trình duyệt rồi thử lại. Bản lưu trước vẫn được giữ.";
}
export function useOfflineSave(session: OfflineSession | null) {
  const [store] = useState(() => createSaveStore());
  const [saved, setSaved] = useState<SavedGame | null>(null);
  const savedRef = useRef<SavedGame | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void store
      .load()
      .then((result) => {
        if (!active || savedRef.current) return;
        savedRef.current = result.save;
        setSaved(result.save);
        if (result.recovered)
          setNotice(
            "Bản lưu gần nhất không đọc được. Có thể tiếp tục từ bản lưu trước.",
          );
      })
      .catch((reason) => {
        if (active) setNotice(saveErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [store]);
  async function write(active: OfflineSession, replace = false) {
    const state = active.snapshot();
    const human = state.players.find((p) => p.kind === "human")!;
    const value = makeSavedGame(state, human.id);
    await (replace ? store.replace(value) : store.save(value));
    if (
      savedRef.current?.gameId !== value.gameId ||
      savedRef.current.revision <= value.revision
    ) {
      savedRef.current = value;
      setSaved(value);
    }
    setError("");
    return value;
  }
  useEffect(() => {
    if (!session) return;
    let active = true;
    let queued = -1;
    const stop = (reason: unknown) => {
      if (!active) return;
      const message = saveErrorMessage(reason);
      setError(message);
      session.pause(message);
    };
    const unsubscribe = session.subscribe((update) => {
      if (
        !update.view ||
        update.connection === "closed" ||
        update.view.revision === queued
      )
        return;
      queued = update.view.revision;
      void write(session).catch(stop);
    });
    const heartbeat = setInterval(() => {
      void store
        .claim()
        .then((ok) => {
          if (!ok) stop(new SaveError("LEASE_LOST"));
        })
        .catch(stop);
    }, 5000);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const state = session.snapshot();
      if (
        savedRef.current?.gameId !== state.gameId ||
        savedRef.current.revision < state.revision
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const pageHide = () => {
      session.pause("Ván đã tạm dừng.");
      void store.release().catch(() => {});
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", pageHide);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", pageHide);
      void store.release().catch(() => {});
    };
  }, [session, store]);
  async function retry() {
    if (!session) return;
    try {
      if (!(await store.claim())) throw new SaveError("LEASE_LOST");
      await write(session);
      session.resume();
    } catch (reason) {
      const message = saveErrorMessage(reason);
      setError(message);
      session.pause(message);
    }
  }
  return {
    store,
    saved,
    write,
    retry,
    notice,
    dismissNotice: () => setNotice(""),
    error,
  };
}
