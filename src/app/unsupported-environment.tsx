import { BrandLogo } from "../components/navigation/icons";
import { messages, type Locale } from "../i18n";
import type { RuntimeSupport } from "./runtime-support";

interface UnsupportedEnvironmentProps {
  locale: Locale;
  reason: Extract<RuntimeSupport, { supported: false }>["reason"];
}

export function UnsupportedEnvironment({
  locale,
  reason,
}: UnsupportedEnvironmentProps) {
  const t = messages[locale];
  const title =
    reason === "insecure-context"
      ? t.secureContextRequiredTitle
      : t.webCryptoUnavailableTitle;
  const body =
    reason === "insecure-context"
      ? t.secureContextRequiredBody
      : t.webCryptoUnavailableBody;

  return (
    <div class="app-shell runtime-blocked-shell">
      <header class="topbar material">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">
            <BrandLogo />
          </span>
          <span>{t.brand}</span>
        </div>
      </header>
      <main class="workspace runtime-blocked-main" id="main-content">
        <section class="flow-panel" role="alert">
          <h1>{title}</h1>
          <p class="lead">{body}</p>
        </section>
      </main>
    </div>
  );
}
