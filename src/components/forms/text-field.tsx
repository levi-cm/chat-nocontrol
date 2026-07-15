import type { Ref } from "preact";

interface TextFieldProps {
  id: string;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  value: string;
  error?: string;
  type?: "text" | "password";
  placeholder?: string;
  disabled?: boolean;
  onInput: (value: string) => void;
  onPaste?: (value: string) => void;
}

export function TextField({
  id,
  inputRef,
  label,
  value,
  error,
  type = "text",
  placeholder,
  disabled = false,
  onInput,
  onPaste,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        onInput={(event) => onInput(event.currentTarget.value)}
        onPaste={
          onPaste
            ? (event) => {
                const value = event.clipboardData?.getData("text/plain") ?? "";
                if (value === "") return;
                event.preventDefault();
                onInput(value);
                onPaste(value);
              }
            : undefined
        }
      />
      {error && (
        <p class="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
