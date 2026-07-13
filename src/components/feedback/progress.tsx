interface ProgressProps {
  label: string;
  value: number;
  maximum: number;
}

export function Progress({ label, value, maximum }: ProgressProps) {
  return (
    <div class="progress-group">
      <span>{label}</span>
      <progress
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={maximum}
        value={value}
        max={maximum}
      >
        {value} / {maximum}
      </progress>
    </div>
  );
}
