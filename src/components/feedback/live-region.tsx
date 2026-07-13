export function LiveRegion({ message }: { message: string }) {
  return (
    <p class="live-region" role="status" aria-live="polite">
      {message}
    </p>
  );
}
