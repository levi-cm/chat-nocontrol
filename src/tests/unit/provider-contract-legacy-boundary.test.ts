// @vitest-environment node

import { describe, expect, it } from "vitest";
import { findForbiddenLegacyWriteSurfaces } from "../../../scripts/check-crypto-provider-contract";

const roots = ["src/main.tsx"];

function sources(...entries: Array<[string, string]>): Map<string, string> {
  return new Map(entries);
}

describe("legacy V1 provider boundary", () => {
  it.each([
    ["object method", "const api = { encryptLegacyV1(): void {} };\nvoid api;"],
    ["class method", "class Api { sendLegacyV1(): void {} }\nvoid Api;"],
    [
      "method signature",
      "interface Api { persistV1Contact(): void }\nconst api = {} as Api;\nvoid api;",
    ],
    [
      "property-access call",
      "declare const api: Record<string, () => void>;\napi.encryptLegacyV1();",
    ],
    [
      "element-access call",
      'declare const api: Record<string, () => void>;\napi["saveLegacyV1Contact"]();',
    ],
  ] as const)("rejects a reachable forbidden %s", (_label, unsafeSource) => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        ["src/features/unsafe.ts", unsafeSource],
      ),
      roots,
    );

    expect(result).not.toEqual([]);
  });

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

  it("rejects forbidden member access from a dynamic legacy import", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          'void import("../crypto/text").then((module) => module.encryptText({} as never));',
        ],
        [
          "src/crypto/text.ts",
          "export function encryptText(): void {}\nexport function decryptText(): void {}",
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden dynamic V1 write access encryptText from src/crypto/text.ts",
    );
  });

  it("rejects forbidden destructuring from a dynamic legacy import", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          'const { encryptText } = await import("../crypto/text");\nencryptText({} as never);',
        ],
        [
          "src/crypto/text.ts",
          "export function encryptText(): void {}\nexport function decryptText(): void {}",
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden dynamic V1 write access encryptText from src/crypto/text.ts",
    );
  });

  it.each([
    ["member", "legacy.encryptText({} as never);"],
    ["bracket", 'legacy["encryptText"]({} as never);'],
    [
      "later destructuring",
      "const { encryptText } = legacy;\nencryptText({} as never);",
    ],
  ] as const)(
    "rejects assigned dynamic namespace %s access",
    (_label, access) => {
      const result = findForbiddenLegacyWriteSurfaces(
        sources(
          ["src/main.tsx", 'import "./features/unsafe";'],
          [
            "src/features/unsafe.ts",
            `const legacy = await import("../crypto/text");\n${access}`,
          ],
          [
            "src/crypto/text.ts",
            "export function encryptText(): void {}\nexport function decryptText(): void {}",
          ],
        ),
        roots,
      );

      expect(result).toContain(
        "src/features/unsafe.ts: forbidden dynamic V1 namespace exposure from src/crypto/text.ts",
      );
    },
  );

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

  it("allows a dynamic legacy import when only a read symbol is accessed", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/safe";'],
        [
          "src/features/safe.ts",
          'const { decryptText } = await import("../crypto/text");\nvoid decryptText;',
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

  it("rejects assigning a dynamic legacy namespace even for later read-only access", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/safe";'],
        [
          "src/features/safe.ts",
          'const legacy = await import("../crypto/text");\nvoid legacy.decryptText;',
        ],
        [
          "src/crypto/text.ts",
          "export function encryptText(): void {}\nexport function decryptText(): void {}",
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/safe.ts: forbidden dynamic V1 namespace exposure from src/crypto/text.ts",
    );
  });

  it.each([
    [
      "computed access",
      'const key = "decryptText";\nvoid (await import("../crypto/text"))[key];',
    ],
    [
      "passing to a helper",
      'declare function consume(value: unknown): void;\nconsume(await import("../crypto/text"));',
    ],
    [
      "returning from a function",
      'export async function loadLegacy(): Promise<unknown> { return await import("../crypto/text"); }',
    ],
    [
      "storage in an object literal",
      'const holder = { legacy: await import("../crypto/text") };\nvoid holder;',
    ],
    [
      "storage in an array literal",
      'const holder = [await import("../crypto/text")];\nvoid holder;',
    ],
  ] as const)("rejects dynamic namespace %s", (_label, unsafeSource) => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        ["src/features/unsafe.ts", unsafeSource],
        [
          "src/crypto/text.ts",
          "export function encryptText(): void {}\nexport function decryptText(): void {}",
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden dynamic V1 namespace exposure from src/crypto/text.ts",
    );
  });

  it.each([
    [
      "rest destructuring",
      'const { decryptText, ...namespace } = await import("../crypto/text");\nvoid namespace;',
    ],
    [
      "computed destructuring",
      'const key = "decryptText";\nconst { [key]: value } = await import("../crypto/text");\nvoid value;',
    ],
  ] as const)(
    "rejects non-static dynamic namespace %s",
    (_label, unsafeSource) => {
      const result = findForbiddenLegacyWriteSurfaces(
        sources(
          ["src/main.tsx", 'import "./features/unsafe";'],
          ["src/features/unsafe.ts", unsafeSource],
          [
            "src/crypto/text.ts",
            "export function encryptText(): void {}\nexport function decryptText(): void {}",
          ],
        ),
        roots,
      );

      expect(result).toContain(
        "src/features/unsafe.ts: forbidden dynamic V1 namespace exposure from src/crypto/text.ts",
      );
    },
  );
});
