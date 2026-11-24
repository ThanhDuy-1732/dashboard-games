import "dialog-polyfill/dist/dialog-polyfill.css";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icon.js";
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    let active = true;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else
      void import("dialog-polyfill").then(({ default: polyfill }) => {
        if (active) {
          polyfill.registerDialog(dialog);
          dialog.showModal();
        }
      });
    return () => {
      active = false;
      dialog.close?.();
      opener?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="app-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        className="icon-button dialog-close"
        onClick={onClose}
        aria-label="Đóng"
      >
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}
