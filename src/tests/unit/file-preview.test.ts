import { describe, expect, it } from "vitest";
import { previewKind } from "../../flows/decrypt/file";

describe("validated file preview allowlist", () => {
  it("supports local raster images, audio, and video", () => {
    expect(previewKind("image/png")).toBe("image");
    expect(previewKind("audio/ogg")).toBe("audio");
    expect(previewKind("video/webm")).toBe("video");
  });

  it("keeps active or unknown formats download-only", () => {
    expect(previewKind("image/svg+xml")).toBeNull();
    expect(previewKind("text/html")).toBeNull();
    expect(previewKind("application/pdf")).toBeNull();
    expect(previewKind("application/vnd.apple.mpegurl")).toBeNull();
    expect(previewKind("application/x-mpegurl")).toBeNull();
    expect(previewKind("audio/x-mpegurl")).toBeNull();
  });
});
