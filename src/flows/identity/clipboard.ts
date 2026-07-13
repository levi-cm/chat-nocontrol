interface ClipboardPort {
  writeText(value: string): Promise<void>;
  readText(): Promise<string>;
}

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
  clipboard: ClipboardPort = navigator.clipboard,
): Promise<boolean> {
  try {
    await clipboard.writeText(value);
  } catch {
    return false;
  }
  setTimeout(() => {
    void clearIfUnchanged(value, clipboard);
  }, 60_000);
  return true;
}
