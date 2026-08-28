import { describe, expect, it, vi } from "vitest";
import * as bootstrap from "../../app/bootstrap";

type CutoverClient = {
  readonly url: string;
  navigate(url: string): Promise<unknown>;
};

type CutoverResult =
  "current" | "ignored" | "navigation-started" | "navigation-failed";

type CutoverApi = {
  readonly CLIENT_VERSION_PROBE: string;
  readonly CLIENT_VERSION_RESPONSE: string;
  createLegacyCutoverTarget(
    clientUrl: string,
    scopeUrl: string,
    currentVersion: string,
  ): string | null;
  isExpectedCat5CutoverSearch(search: string, currentVersion: string): boolean;
  isSafeLegacyCutoverPredecessor(
    currentUrl: string,
    previousUrl: string,
  ): boolean;
  forceLegacyClientCutover(
    client: CutoverClient,
    currentVersion: string,
    scopeUrl: string,
    probe: (
      client: CutoverClient,
      expectedVersion: string,
    ) => Promise<string | null>,
  ): Promise<CutoverResult>;
  installClientVersionResponder(
    currentVersion: string,
    target: {
      addEventListener(
        type: "message",
        listener: (event: MessageEvent) => void,
      ): void;
      removeEventListener(
        type: "message",
        listener: (event: MessageEvent) => void,
      ): void;
    },
  ): () => void;
};

const api = bootstrap as unknown as Partial<CutoverApi>;
const scope = "https://app.example/chat-nocontrol/";

describe("forced legacy PWA cutover", () => {
  it("exposes a bounded version-probe cutover API", () => {
    expect(api.createLegacyCutoverTarget).toBeTypeOf("function");
    expect(api.isExpectedCat5CutoverSearch).toBeTypeOf("function");
    expect(api.isSafeLegacyCutoverPredecessor).toBeTypeOf("function");
    expect(api.forceLegacyClientCutover).toBeTypeOf("function");
    expect(api.installClientVersionResponder).toBeTypeOf("function");
    expect(api.CLIENT_VERSION_PROBE).toBeTypeOf("string");
    expect(api.CLIENT_VERSION_RESPONSE).toBeTypeOf("string");
  });

  it("backs up only into an exact app-owned sensitive-fragment predecessor", () => {
    if (!api.isSafeLegacyCutoverPredecessor) return;
    const current = `${scope}?cat5-cutover=0.2.0-beta.1#/m/Abc`;
    expect(api.isSafeLegacyCutoverPredecessor(current, `${scope}#/m/Abc`)).toBe(
      true,
    );
    for (const previous of [
      "https://other.example/chat-nocontrol/#/m/Abc",
      "https://app.example/other/#/m/Abc",
      `${scope}?query=visible#/m/Abc`,
      `${scope}#/decrypt`,
      `${scope}#/m/not+base64`,
    ]) {
      expect(api.isSafeLegacyCutoverPredecessor(current, previous)).toBe(false);
    }
  });

  it.each([
    "#/m/Abc_123-xyz",
    "#/decrypt/qr/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-",
  ])("preserves supported incoming fragment shape %s", (hash) => {
    if (!api.createLegacyCutoverTarget) return;
    expect(
      api.createLegacyCutoverTarget(`${scope}${hash}`, scope, "0.2.0-beta.1"),
    ).toBe(`${scope}?cat5-cutover=0.2.0-beta.1${hash}`);
  });

  it.each([
    "#/m",
    "#/m/",
    "#/m/not+base64",
    "#/decrypt/qr",
    "#/decrypt/qr/",
    "#/decrypt/qr/lowercase",
    "#/unrelated/value",
  ])("scrubs malformed or unrelated fragment %s", (hash) => {
    if (!api.createLegacyCutoverTarget) return;
    expect(
      api.createLegacyCutoverTarget(
        `${scope}?discard=yes${hash}`,
        scope,
        "0.2.0-beta.1",
      ),
    ).toBe(`${scope}?cat5-cutover=0.2.0-beta.1#/decrypt`);
  });

  it("rejects clients outside the active worker scope", () => {
    if (!api.createLegacyCutoverTarget) return;
    expect(
      api.createLegacyCutoverTarget(
        "https://app.example/other/#/m/Abc",
        scope,
        "0.2.0-beta.1",
      ),
    ).toBeNull();
    expect(
      api.createLegacyCutoverTarget(
        "https://other.example/chat-nocontrol/#/m/Abc",
        scope,
        "0.2.0-beta.1",
      ),
    ).toBeNull();
  });

  it("accepts only the exact single version cutover marker", () => {
    if (!api.isExpectedCat5CutoverSearch) return;
    expect(
      api.isExpectedCat5CutoverSearch(
        "?cat5-cutover=0.2.0-beta.1",
        "0.2.0-beta.1",
      ),
    ).toBe(true);
    for (const search of [
      "",
      "?cat5-cutover=0.1.0-beta.1",
      "?cat5-cutover=0.2.0-beta.1&extra=1",
      "?extra=1&cat5-cutover=0.2.0-beta.1",
    ]) {
      expect(api.isExpectedCat5CutoverSearch(search, "0.2.0-beta.1")).toBe(
        false,
      );
    }
  });

  it("does not interrupt a client already running the same CAT5 version", async () => {
    if (!api.forceLegacyClientCutover) return;
    const navigate = vi.fn(() => Promise.resolve({}));
    const client = { url: `${scope}#/m/Abc`, navigate };

    await expect(
      api.forceLegacyClientCutover(client, "0.2.0-beta.1", scope, () =>
        Promise.resolve("0.2.0-beta.1"),
      ),
    ).resolves.toBe("current");
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([null, "0.1.0-beta.1"])(
    "navigates a legacy client exactly once when probe reports %s",
    async (reportedVersion) => {
      if (!api.forceLegacyClientCutover) return;
      const navigate = vi.fn(() => Promise.resolve({}));
      const client = { url: `${scope}#/m/Abc`, navigate };

      await expect(
        api.forceLegacyClientCutover(client, "0.2.0-beta.1", scope, () =>
          Promise.resolve(reportedVersion),
        ),
      ).resolves.toBe("navigation-started");
      expect(navigate).toHaveBeenCalledOnce();
      expect(navigate).toHaveBeenCalledWith(
        `${scope}?cat5-cutover=0.2.0-beta.1#/m/Abc`,
      );
    },
  );

  it("handles one rejected navigation without retrying or blocking activation", async () => {
    if (!api.forceLegacyClientCutover) return;
    const navigate = vi.fn(() =>
      Promise.reject(new Error("navigation rejected")),
    );
    const client = { url: `${scope}#/m/Abc`, navigate };

    await expect(
      api.forceLegacyClientCutover(client, "0.2.0-beta.1", scope, () =>
        Promise.resolve(null),
      ),
    ).resolves.toBe("navigation-started");
    expect(navigate).toHaveBeenCalledOnce();
    await Promise.resolve();
  });

  it("fails closed after one synchronous navigation error", async () => {
    if (!api.forceLegacyClientCutover) return;
    const navigate = vi.fn(() => {
      throw new Error("navigation unavailable");
    });
    const client = { url: `${scope}#/m/Abc`, navigate };

    await expect(
      api.forceLegacyClientCutover(client, "0.2.0-beta.1", scope, () =>
        Promise.resolve(null),
      ),
    ).resolves.toBe("navigation-failed");
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("does not loop when the version-specific cutover was already attempted", async () => {
    if (!api.forceLegacyClientCutover) return;
    const navigate = vi.fn(() => Promise.resolve({}));
    const client = {
      url: `${scope}?cat5-cutover=0.2.0-beta.1#/m/Abc`,
      navigate,
    };

    await expect(
      api.forceLegacyClientCutover(client, "0.2.0-beta.1", scope, () =>
        Promise.resolve(null),
      ),
    ).resolves.toBe("ignored");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("answers a worker probe with only the exact CAT5 version", () => {
    if (
      !api.installClientVersionResponder ||
      !api.CLIENT_VERSION_PROBE ||
      !api.CLIENT_VERSION_RESPONSE
    )
      return;
    let listener: ((event: MessageEvent) => void) | null = null;
    const target = {
      addEventListener: vi.fn(
        (_type: "message", next: (event: MessageEvent) => void) => {
          listener = next;
        },
      ),
      removeEventListener: vi.fn(),
    };
    const postMessage = vi.fn();
    const cleanup = api.installClientVersionResponder("0.2.0-beta.1", target);

    expect(listener).not.toBeNull();
    (listener as unknown as (event: MessageEvent) => void)({
      data: { type: api.CLIENT_VERSION_PROBE },
      ports: [{ postMessage }],
    } as unknown as MessageEvent);
    expect(postMessage).toHaveBeenCalledWith({
      type: api.CLIENT_VERSION_RESPONSE,
      version: "0.2.0-beta.1",
    });
    cleanup();
    expect(target.removeEventListener).toHaveBeenCalledWith(
      "message",
      listener,
    );
  });
});
