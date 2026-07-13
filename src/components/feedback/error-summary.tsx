import type { Ref } from "preact";

interface ErrorSummaryProps {
  title: string;
  errors: string[];
  summaryRef?: Ref<HTMLElement>;
}

export function ErrorSummary({ title, errors, summaryRef }: ErrorSummaryProps) {
  if (errors.length === 0) return null;
  return (
    <section
      class="error-summary"
      role="alert"
      ref={summaryRef}
      tabIndex={summaryRef ? -1 : undefined}
    >
      <h2>{title}</h2>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </section>
  );
}
