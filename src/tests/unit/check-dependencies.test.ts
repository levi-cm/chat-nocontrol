// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileSyncMock, spawnSyncMock } = vi.hoisted(() => ({
  readFileSyncMock: vi.fn((path: string) => {
    const manifest = {
      dependencies: { runtime: "1.2.3" },
      devDependencies: { tooling: "4.5.6" },
    };

    if (
      path === "package.json" ||
      path === "scripts/approved-dependencies.json"
    ) {
      return JSON.stringify(manifest);
    }

    throw new Error(`Unexpected fixture read: ${path}`);
  }),
  spawnSyncMock: vi.fn(),
}));

vi.mock("node:fs", () => ({ readFileSync: readFileSyncMock }));
vi.mock("node:child_process", () => ({ spawnSync: spawnSyncMock }));

describe("dependency review audit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({
      error: undefined,
      signal: null,
      status: 0,
      stderr: "",
      stdout: "",
    });
  });

  it("audits the complete graph including optional dependencies", async () => {
    await import("../../../scripts/check-dependencies");

    expect(spawnSyncMock).toHaveBeenCalledWith(
      "npm",
      ["audit", "--audit-level=high", "--include=optional"],
      { encoding: "utf8" },
    );
    expect(spawnSyncMock.mock.calls[0]?.[1]).not.toContain("--omit=optional");
  });

  it("reports an npm audit process that could not start", async () => {
    spawnSyncMock.mockReturnValue({
      error: new Error("spawn npm ENOENT"),
      signal: null,
      status: null,
      stderr: "",
      stdout: "",
    });

    await expect(import("../../../scripts/check-dependencies")).rejects.toThrow(
      "Dependency audit failed to start: spawn npm ENOENT",
    );
  });

  it("reports the signal when npm audit is terminated", async () => {
    spawnSyncMock.mockReturnValue({
      error: undefined,
      signal: "SIGTERM",
      status: null,
      stderr: "",
      stdout: "",
    });

    await expect(import("../../../scripts/check-dependencies")).rejects.toThrow(
      "Dependency audit terminated by signal SIGTERM",
    );
  });

  it("rejects range-based npm aliases even when they are approved", async () => {
    const manifest = JSON.stringify({
      dependencies: {},
      devDependencies: { tooling: "npm:typescript@^6.0.3" },
    });
    readFileSyncMock
      .mockReturnValueOnce(manifest)
      .mockReturnValueOnce(manifest);

    await expect(import("../../../scripts/check-dependencies")).rejects.toThrow(
      "unpinned=tooling",
    );
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it.each(["constructor", "toString"])(
    "rejects the inherited-key dependency name %s unless explicitly approved",
    async (dependencyName) => {
      readFileSyncMock
        .mockReturnValueOnce(
          JSON.stringify({
            dependencies: { [dependencyName]: "1.2.3" },
            devDependencies: {},
          }),
        )
        .mockReturnValueOnce(
          JSON.stringify({ dependencies: {}, devDependencies: {} }),
        );

      await expect(
        import("../../../scripts/check-dependencies"),
      ).rejects.toThrow(`dependencies:unexpected:${dependencyName}@1.2.3`);
      expect(spawnSyncMock).not.toHaveBeenCalled();
    },
  );
});
