export function PasteButton({
  label,
  unavailableLabel,
  failureLabel,
  disabled = false,
  onPaste,
  onError,
}: {
  label: string;
  unavailableLabel: string;
  failureLabel: string;
  disabled?: boolean;
  onPaste: (value: string) => void;
  onError: (message: string) => void;
}) {
  const available = typeof navigator.clipboard?.readText === "function";

  return (
    <button
      class="button secondary paste-button"
      type="button"
      disabled={disabled || !available}
      title={available ? undefined : unavailableLabel}
      onClick={() => {
        void navigator.clipboard
          .readText()
          .then((value) => {
            onPaste(value);
            onError("");
          })
          .catch(() => onError(failureLabel));
      }}
    >
      <span class="paste-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M9 5.5h6M9.5 3.5h5a1.5 1.5 0 0 1 1.5 1.5v1H8V5a1.5 1.5 0 0 1 1.5-1.5Z" />
          <path d="M7 6H5.5A1.5 1.5 0 0 0 4 7.5v12A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 18.5 6H17" />
        </svg>
      </span>
      {label}
    </button>
  );
}
