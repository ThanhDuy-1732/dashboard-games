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
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} aria-label={title} onCancel={onClose}>
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
