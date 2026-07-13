import { describe, expect, it } from "vitest";
import manifest from "../../../package.json";
import { CHAT_NOCONTROL_VERSION } from "../../app/build-info";

describe("build metadata", () => {
  it("injects the package version into user-visible diagnostics", () => {
    expect(CHAT_NOCONTROL_VERSION).toBe(manifest.version);
  });
});
