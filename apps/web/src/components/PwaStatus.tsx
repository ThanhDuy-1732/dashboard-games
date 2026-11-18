import { useEffect, useRef, useState } from "react";
import { registerPwa } from "../pwa/register.js";
import { isNative } from "../platform.js";
import { Dialog } from "./Dialog.js";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaStatus({ inGame }: { inGame: boolean }) {
  const playing = useRef(inGame);
  playing.current = inGame;
  const [ready, setReady] = useState(false),
    [refresh, setRefresh] = useState(false),
    [error, setError] = useState(""),
    [guide, setGuide] = useState(false),
    [install, setInstall] = useState<InstallEvent | null>(null);
  const registration = useRef<Awaited<ReturnType<typeof registerPwa>> | null>(
    null,
  );
  useEffect(() => {
    if (!import.meta.env.PROD || isNative()) return;
    let active = true;
    void registerPwa({
      isNative: false,
      inGame: () => playing.current,
      onOfflineReady: () => {
        if (active) setReady(true);
      },
      onUpdateReady: () => {
        if (active) setRefresh(true);
      },
      onError: () => {
        if (active)
          setError(
            "Chưa sẵn sàng chơi offline. Kết nối mạng và mở lại ứng dụng để tải đủ dữ liệu.",
          );
      },
    }).then((value) => {
      if (active) registration.current = value;
      else value.dispose();
    });
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    const installed = () => setInstall(null);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      active = false;
      registration.current?.dispose();
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (isNative() || !import.meta.env.PROD) return null;
  return (
    <>
      <div className="pwa-status" aria-live="polite">
        {error ||
          (ready
            ? "Đã sẵn sàng chơi với máy khi offline."
            : "Đang chuẩn bị dữ liệu chơi offline…")}{" "}
        <button
          className="text-button"
          onClick={() => {
            if (install) {
              void install
                .prompt()
                .then(() => install.userChoice)
                .then(() => setInstall(null))
                .catch(() => setGuide(true));
            } else setGuide(true);
          }}
        >
          {install ? "Cài ứng dụng" : "Hướng dẫn cài"}
        </button>
        {refresh && (
          <span>
            {" "}
            Có bản cập nhật mới.{" "}
            {inGame ? (
              "Rời và lưu ván trước khi cập nhật."
            ) : (
              <>
                <button
                  className="text-button"
                  onClick={() => void registration.current?.update()}
                >
                  Cập nhật ngay
                </button>
                <button
                  className="text-button"
                  onClick={() => setRefresh(false)}
                >
                  Để sau
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {guide && (
        <Dialog title="Cài Nhà Chơi" onClose={() => setGuide(false)}>
          <h2>Nhà Chơi trên màn hình chính</h2>
          <p>
            iPhone / iPad: mở bằng Safari, nhấn Chia sẻ → Thêm vào màn hình
            chính.
          </p>
          <p>
            Android: mở bằng Chrome, vào menu ⋮ → Cài ứng dụng hoặc Thêm vào màn
            hình chính.
          </p>
          <p>
            Máy tính: dùng biểu tượng cài ứng dụng trên thanh địa chỉ nếu trình
            duyệt hỗ trợ.
          </p>
          <p>
            Chờ thông báo sẵn sàng offline trước khi ngắt mạng. Chơi online vẫn
            cần internet.
          </p>
        </Dialog>
      )}
    </>
  );
}
