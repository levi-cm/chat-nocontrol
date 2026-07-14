export interface RevocableObjectUrl {
  readonly url: string;
  revoke(): void;
}

/** Owns one object URL and makes cleanup safe to call from overlapping effects. */
export function createRevocableObjectUrl(blob: Blob): RevocableObjectUrl {
  const url = URL.createObjectURL(blob);
  let revoked = false;
  return {
    url,
    revoke() {
      if (revoked) return;
      revoked = true;
      URL.revokeObjectURL(url);
    },
  };
}

/** Starts a local download and revokes its temporary URL on the next task. */
export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = createRevocableObjectUrl(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl.url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => objectUrl.revoke(), 0);
}

/** Starts a download for a browser-generated data URL without network access. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}
