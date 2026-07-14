interface ClipboardPort {
  writeText(value: string): Promise<void>;
  readText(): Promise<string>;
}

export type CopyResult = "copied" | "selected" | "failed";

async function clearIfUnchanged(
  copiedValue: string,
  clipboard: ClipboardPort,
): Promise<void> {
  try {
    if ((await clipboard.readText()) === copiedValue) {
      await clipboard.writeText("");
    }
  } catch {
    // Best effort only. Browser permission and later clipboard changes win.
  }
}

export async function copyWithBestEffortClear(
  value: string,
  target: HTMLTextAreaElement,
  clipboard: ClipboardPort | undefined = navigator.clipboard,
  legacyCopy: () => boolean = () => document.execCommand("copy"),
): Promise<CopyResult> {
  if (clipboard) {
    try {
      await clipboard.writeText(value);
      setTimeout(() => {
        void clearIfUnchanged(value, clipboard);
      }, 60_000);
      return "copied";
    } catch {
      // Continue with the synchronous selection fallback from this user click.
    }
  }

  try {
    target.focus();
    target.select();
    target.setSelectionRange(0, target.value.length);
  } catch {
    return "failed";
  }
  try {
    return legacyCopy() ? "copied" : "selected";
  } catch {
    return "selected";
  }
}
