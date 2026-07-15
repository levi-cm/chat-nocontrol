import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { AppRoot } from "../../app/root";
import {
  checkRuntimeSupport,
  runtimeSupportForBuild,
} from "../../app/runtime-support";

afterEach(cleanup);

describe("runtime support", () => {
  it("rejects an insecure origin before checking WebCrypto", () => {
    expect(
      checkRuntimeSupport({
        isSecureContext: false,
        crypto: { subtle: {} as SubtleCrypto },
      }),
    ).toEqual({ supported: false, reason: "insecure-context" });
  });

  it("rejects a secure origin without SubtleCrypto", () => {
    expect(checkRuntimeSupport({ isSecureContext: true, crypto: {} })).toEqual({
      supported: false,
      reason: "missing-webcrypto",
    });
  });

  it("accepts a secure origin with SubtleCrypto", () => {
    expect(
      checkRuntimeSupport({
        isSecureContext: true,
        crypto: { subtle: {} as SubtleCrypto },
      }),
    ).toEqual({ supported: true });
  });

  it("allows an insecure origin only in a development build", () => {
    const insecure = {
      supported: false as const,
      reason: "insecure-context" as const,
    };
    expect(runtimeSupportForBuild(false, insecure)).toEqual({
      supported: true,
    });
    expect(runtimeSupportForBuild(true, insecure)).toEqual(insecure);
  });
});

describe("unsupported runtime screen", () => {
  it("blocks the app before identity creation on insecure HTTP", () => {
    render(
      <AppRoot
        locale="en"
        runtimeSupport={{ supported: false, reason: "insecure-context" }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Secure connection required" }),
    ).not.toBeNull();
    expect(screen.getByText(/HTTPS or localhost/u)).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Create new identity" }),
    ).toBeNull();
  });

  it("explains missing WebCrypto in German", () => {
    render(
      <AppRoot
        locale="de"
        runtimeSupport={{ supported: false, reason: "missing-webcrypto" }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Browser-Verschlüsselung nicht verfügbar",
      }),
    ).not.toBeNull();
    expect(screen.getByText(/anderen aktuellen Browser/u)).not.toBeNull();
    expect(document.documentElement.lang).toBe("de");
  });
});
