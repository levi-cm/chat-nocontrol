import {
  estimatePassphraseBits,
  passphraseStrengthBand,
} from "../../crypto/vault";
import type { MessageKey } from "../../i18n";

export function PassphraseMeter({
  value,
  t,
}: {
  value: string;
  t: (key: MessageKey) => string;
}) {
  const bits = estimatePassphraseBits(value);
  const band = passphraseStrengthBand(bits);
  const bandLabel = t(
    band === "strong"
      ? "passphraseStrong"
      : band === "medium"
        ? "passphraseMedium"
        : "passphraseWeak",
  );
  const width = `${Math.min(100, (bits / 100) * 100)}%`;

  return (
    <div class={`passphrase-meter ${band}`} role="status" aria-live="polite">
      <div class="passphrase-meter-copy">
        <span>{t("estimatedBits").replace("{bits}", String(bits))}</span>
        <strong>{bandLabel}</strong>
      </div>
      <span class="passphrase-meter-track" aria-hidden="true">
        <span style={{ width }} />
      </span>
    </div>
  );
}
