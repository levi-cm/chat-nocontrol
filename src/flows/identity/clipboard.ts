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
  try {
    target.focus();
    target.select();
    target.setSelectionRange(0, target.value.length);
  } catch {
    return "failed";
  }

  let clipboardWrite = Promise.resolve(false);
  if (clipboard) {
    try {
      clipboardWrite = clipboard.writeText(value).then(
        () => true,
        () => false,
      );
    } catch {
      clipboardWrite = Promise.resolve(false);
    }
  }
  let legacyCopied = false;
  try {
    legacyCopied = legacyCopy();
  } catch {
    legacyCopied = false;
  }
  const clipboardCopied = await clipboardWrite;
  if (!clipboardCopied && !legacyCopied) return "selected";
  if (clipboard) {
    setTimeout(() => {
      void clearIfUnchanged(value, clipboard);
    }, 60_000);
  }
  return "copied";
}
