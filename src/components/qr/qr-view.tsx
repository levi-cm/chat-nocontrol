import { useEffect, useRef, useState } from "preact/hooks";
import { generateQrDataUrl } from "./generate";

interface QrViewProps {
  text: string;
  label: string;
  enlargeLabel?: string;
  closeLabel?: string;
}

export function QrView({ text, label, enlargeLabel, closeLabel }: QrViewProps) {
  const [source, setSource] = useState("");
  const [enlarged, setEnlarged] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void generateQrDataUrl(text)
      .then((url) => {
        if (active) setSource(url);
      })
      .catch(() => {
        if (active) setSource("");
      });
    return () => {
      active = false;
    };
  }, [text]);

  useEffect(() => {
    if (!enlarged) return;
    close.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        close.current?.focus();
        return;
      }
      if (event.key === "Escape") setEnlarged(false);
    };
    window.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("keydown", dismiss);
      trigger.current?.focus();
    };
  }, [enlarged]);

  if (!source) return null;
  if (!enlargeLabel || !closeLabel) {
    return <img class="qr-image" src={source} alt={label} />;
  }
  return (
    <>
      <button
        ref={trigger}
        class="qr-enlarge-trigger"
        type="button"
        aria-label={enlargeLabel}
        onClick={() => setEnlarged(true)}
      >
        <img class="qr-image" src={source} alt={label} />
      </button>
      {enlarged && (
        <div
          class="qr-enlarged-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <button
            ref={close}
            class="button secondary qr-enlarged-close"
            type="button"
            onClick={() => setEnlarged(false)}
          >
            {closeLabel}
          </button>
          <img class="qr-enlarged-image" src={source} alt={label} />
        </div>
      )}
    </>
  );
}
