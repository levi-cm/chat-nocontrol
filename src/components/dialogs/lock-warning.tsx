interface LockWarningProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LockWarning({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: LockWarningProps) {
  return (
    <section
      class="dialog-panel"
      role="alertdialog"
      aria-labelledby="lock-title"
    >
      <h2 id="lock-title">{title}</h2>
      <p>{body}</p>
      <div class="action-row">
        <button class="button primary" type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button class="button secondary" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </section>
  );
}
