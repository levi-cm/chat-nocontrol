import { useLayoutEffect } from "preact/hooks";
import { App } from "./App";
import { readStoredLocale } from "./bootstrap";
import { checkRuntimeSupport, type RuntimeSupport } from "./runtime-support";
import { UnsupportedEnvironment } from "./unsupported-environment";
import type { Locale } from "../i18n";
import type { IncomingMessageIntent } from "../protocol/message-link";

interface AppRootProps {
  locale?: Locale;
  runtimeSupport?: RuntimeSupport;
  initialIncomingIntent?: IncomingMessageIntent | null;
}

export function AppRoot({
  locale = readStoredLocale(),
  runtimeSupport = checkRuntimeSupport(),
  initialIncomingIntent = null,
}: AppRootProps) {
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (!runtimeSupport.supported) {
    return (
      <UnsupportedEnvironment locale={locale} reason={runtimeSupport.reason} />
    );
  }
  return <App initialIncomingIntent={initialIncomingIntent} />;
}
