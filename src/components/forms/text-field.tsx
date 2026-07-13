interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  type?: "text" | "password";
  placeholder?: string;
  disabled?: boolean;
  onInput: (value: string) => void;
}

export function TextField({
  id,
  label,
  value,
  error,
  type = "text",
  placeholder,
  disabled = false,
  onInput,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        onInput={(event) => onInput(event.currentTarget.value)}
      />
      {error && (
        <p class="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
