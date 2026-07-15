import { useEffect, useRef } from "preact/hooks";
import type { MessageKey } from "../../i18n";

export function ConfirmationDialog({
  t,
  title,
  body,
  cancelLabel,
  confirmLabel,
  returnFocus,
  onCancel,
  onConfirm,
}: {
  t: (key: MessageKey) => string;
  title: string;
  body: string;
  cancelLabel?: string;
  confirmLabel?: string;
  returnFocus?: () => HTMLElement | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const returnFocusTarget = useRef(returnFocus);

  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelButton.current?.focus();
    return () =>
      (returnFocusTarget.current?.() ?? previousFocus.current)?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    if (event.shiftKey && document.activeElement === cancelButton.current) {
      event.preventDefault();
      confirmButton.current?.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === confirmButton.current
    ) {
      event.preventDefault();
      cancelButton.current?.focus();
    }
  };

  return (
    <div class="dialog-backdrop" onKeyDown={handleKeyDown}>
      <div
        class="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-body"
      >
        <h2 id="confirmation-title">{title}</h2>
        <p id="confirmation-body">{body}</p>
        <div class="action-row">
          <button
            ref={cancelButton}
            class="button secondary"
            type="button"
            onClick={onCancel}
          >
            {cancelLabel ?? t("cancel")}
          </button>
          <button
            ref={confirmButton}
            class="button danger-button"
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel ?? t("delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
