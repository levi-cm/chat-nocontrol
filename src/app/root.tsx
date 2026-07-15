import { useLayoutEffect } from "preact/hooks";
import { App } from "./App";
import { readStoredLocale } from "./bootstrap";
import { checkRuntimeSupport, type RuntimeSupport } from "./runtime-support";
import { UnsupportedEnvironment } from "./unsupported-environment";
import type { Locale } from "../i18n";

interface AppRootProps {
  locale?: Locale;
  runtimeSupport?: RuntimeSupport;
}

export function AppRoot({
  locale = readStoredLocale(),
  runtimeSupport = checkRuntimeSupport(),
}: AppRootProps) {
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (!runtimeSupport.supported) {
    return (
      <UnsupportedEnvironment locale={locale} reason={runtimeSupport.reason} />
    );
  }
  return <App />;
}
