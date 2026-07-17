import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { App } from "./App";
import { readStoredLocale } from "./bootstrap";
import { checkRuntimeSupport, type RuntimeSupport } from "./runtime-support";
import { UnsupportedEnvironment } from "./unsupported-environment";
import type { Locale } from "../i18n";
import type { IncomingMessageIntentV2 } from "../protocol/message-link-v2";
import { createIncomingSharedArtifactHandoff } from "../share/incoming-shared-artifact";
import { zeroize } from "../crypto/zeroize";

interface AppRootProps {
  locale?: Locale;
  runtimeSupport?: RuntimeSupport;
  initialIncomingIntent?: IncomingMessageIntentV2 | null;
}

export function AppRoot({
  locale = readStoredLocale(),
  runtimeSupport = checkRuntimeSupport(),
  initialIncomingIntent = null,
}: AppRootProps) {
  const [incomingSharedText, setIncomingSharedText] = useState<string | null>(
    null,
  );

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handoff = createIncomingSharedArtifactHandoff(
      navigator.serviceWorker,
      (artifact) => {
        try {
          setIncomingSharedText(
            new TextDecoder("utf-8", { fatal: true }).decode(artifact.bytes),
          );
        } finally {
          zeroize(artifact.bytes);
        }
      },
    );
    return () => handoff.dispose();
  }, []);

  if (!runtimeSupport.supported) {
    return (
      <UnsupportedEnvironment locale={locale} reason={runtimeSupport.reason} />
    );
  }
  return (
    <App
      initialIncomingIntent={initialIncomingIntent}
      incomingSharedText={incomingSharedText}
      onIncomingSharedTextConsumed={() => setIncomingSharedText(null)}
    />
  );
}
