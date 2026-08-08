// @vitest-environment node

import { describe, expect, it } from "vitest";
import { findForbiddenLegacyWriteSurfaces } from "../../../scripts/check-crypto-provider-contract";

const roots = ["src/main.tsx"];

function sources(...entries: Array<[string, string]>): Map<string, string> {
  return new Map(entries);
}

describe("legacy V1 provider boundary", () => {
  it.each([
    [
      "worker kind",
      "src/features/commands.ts",
      'export const request = { kind: "encrypt-compact-v1" };',
    ],
    [
      "exported send API",
      "src/features/sharing.ts",
      "export function sendLegacyV1Message(): void {}",
    ],
    [
      "contact persistence API",
      "src/features/contacts.ts",
      "export function persistV1Contact(): void {}",
    ],
  ] as const)(
    "rejects a reachable %s outside the legacy worker files",
    (_label, featurePath, featureSource) => {
      const result = findForbiddenLegacyWriteSurfaces(
        sources(
          ["src/main.tsx", `import "./${featurePath.slice(4, -3)}";`],
          [featurePath, featureSource],
        ),
        roots,
      );

      expect(result).not.toEqual([]);
    },
  );

  it("rejects a reachable import and call of a dormant V1 encrypt symbol", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          'import { encryptText as oldEncrypt } from "../crypto/text";\noldEncrypt({} as never);',
        ],
        [
          "src/crypto/text.ts",
          "export function encryptText(): void {}\nexport function decryptText(): void {}",
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden V1 write import encryptText from src/crypto/text.ts",
    );
  });

  it("allows dormant V1 write exports when only read symbols cross the boundary", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./crypto/legacy-v1-reader";'],
        [
          "src/crypto/legacy-v1-reader.ts",
          'import { decryptText } from "./text";\nvoid decryptText;',
        ],
        [
          "src/crypto/text.ts",
          "export function encryptText(): void {}\nexport function decryptText(): void {}",
        ],
      ),
      roots,
    );

    expect(result).toEqual([]);
  });
});
