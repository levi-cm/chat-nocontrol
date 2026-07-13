import { useEffect, useState } from "preact/hooks";
import { generateQrDataUrl } from "./generate";

interface QrViewProps {
  text: string;
  label: string;
}

export function QrView({ text, label }: QrViewProps) {
  const [source, setSource] = useState("");

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

  return source ? <img class="qr-image" src={source} alt={label} /> : null;
}
