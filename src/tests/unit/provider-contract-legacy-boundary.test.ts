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
      "object arrow property",
      "const api = { encryptLegacyV1: () => undefined };\nvoid api;",
    ],
    [
      "object function property",
      "const api = { saveV1Contact: function (): void {} };\nvoid api;",
    ],
    [
      "computed object method",
      'const api = { ["encryptLegacyV1"](): void {} };\nvoid api;',
    ],
    [
      "computed class method",
      'class Api { ["sendLegacyV1"](): void {} }\nvoid Api;',
    ],
    [
      "computed getter",
      'class Api { get ["persistV1Contact"](): undefined { return undefined; } }\nvoid Api;',
    ],
    [
      "computed setter",
      'class Api { set ["saveV1Contact"](_value: unknown) {} }\nvoid Api;',
    ],
    [
      "concatenated computed object method",
      'const prefix = "encrypt";\nconst api = { [prefix + "LegacyV1"](): void {} };\nvoid api;',
    ],
    [
      "named function property with neutral key",
      "const api = { writer: function encryptLegacyV1(): void {} };\nvoid api;",
    ],
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

  it("fails closed on an unresolved computed callable definition", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          "declare function operationName(): string;\nconst api = { [operationName()](): void {} };\nvoid api;",
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden non-static computed surface prevents V1 boundary analysis",
    );
  });

  it("rejects an aliased string-literal element call", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          'const key = "encryptLegacyV1";\ndeclare const api: Record<string, () => void>;\napi[key]();',
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden V1 write surface encryptLegacyV1",
    );
  });

  it.each([
    [
      "property extraction",
      "declare const api: Record<string, () => void>;\nconst write = api.encryptLegacyV1;\nwrite();",
    ],
    [
      "literal element extraction",
      'declare const api: Record<string, () => void>;\nconst write = api["encryptLegacyV1"];\nwrite();',
    ],
    [
      "aliased element extraction",
      'const key = "encryptLegacyV1";\ndeclare const api: Record<string, () => void>;\nconst write = api[key];\nwrite();',
    ],
    [
      "object destructuring extraction",
      "declare const api: Record<string, () => void>;\nconst { encryptLegacyV1: write } = api;\nwrite();",
    ],
    [
      "computed object destructuring extraction",
      'const key = "encryptLegacyV1";\ndeclare const api: Record<string, () => void>;\nconst { [key]: write } = api;\nwrite();',
    ],
  ] as const)("rejects a reachable V1 writer %s", (_label, unsafeSource) => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        ["src/features/unsafe.ts", unsafeSource],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden V1 write surface encryptLegacyV1",
    );
  });

  it.each([
    "downgradeCat5ToV1",
    "convertCat5ToLegacy",
    "migrateV2ToV1",
  ] as const)("rejects CAT5-to-V1 downgrade surface %s", (name) => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        ["src/features/unsafe.ts", `export function ${name}(): void {}`],
      ),
      roots,
    );

    expect(result).toContain(
      `src/features/unsafe.ts: forbidden CAT5-to-V1 downgrade surface ${name}`,
    );
  });

  it("rejects reintroduction of the legacy message-QR writer module", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./components/qr/message";'],
        [
          "src/components/qr/message.ts",
          "export function prepareMessageQr(): void {}\nexport function generateMessageQrPng(): void {}",
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/components/qr/message.ts: forbidden reachable legacy message-QR writer module",
    );
  });

  it.each(["prepareMessageQr", "generateMessageQrPng"] as const)(
    "rejects future message-QR writer surface %s in any reachable module",
    (name) => {
      const result = findForbiddenLegacyWriteSurfaces(
        sources(
          ["src/main.tsx", 'import "./features/message-qr";'],
          ["src/features/message-qr.ts", `export function ${name}(): void {}`],
        ),
        roots,
      );

      expect(result).toContain(
        `src/features/message-qr.ts: forbidden message-QR writer surface ${name}`,
      );
    },
  );

  it.each([
    ["PPXQ encoder", "encodeQrMessageText", "src/protocol/ppxq.ts"],
    [
      "V1 message-link encoder",
      "encodeMessageLink",
      "src/protocol/message-link.ts",
    ],
  ] as const)("rejects a reachable %s import", (_label, name, target) => {
    const leaf = target.slice("src/".length, -".ts".length);
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          `import { ${name} } from "../${leaf}";\nvoid ${name};`,
        ],
        [target, `export function ${name}(): void {}`],
      ),
      roots,
    );

    expect(result).toContain(
      `src/features/unsafe.ts: forbidden V1 write import ${name} from ${target}`,
    );
  });

  it.each([
    "downgrade-cat5-to-v1",
    "convert-cat5-to-v1",
    "encrypt-cat5-as-v1",
  ] as const)("rejects CAT5-to-V1 worker kind %s", (kind) => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          `export const request = { kind: "${kind}" };`,
        ],
      ),
      roots,
    );

    expect(result).toContain(
      `src/features/unsafe.ts: forbidden V1 worker request kind ${kind}`,
    );
  });

  it.each([
    [
      "deriveIdentityFromEntropy",
      "src/crypto/identity.ts",
      'import { deriveIdentityFromEntropy } from "../crypto/identity";\nvoid deriveIdentityFromEntropy;',
    ],
    [
      "unlockVault",
      "src/crypto/vault.ts",
      'import { unlockVault } from "../crypto/vault";\nvoid unlockVault;',
    ],
  ] as const)(
    "rejects main-thread V1 secret import %s",
    (name, target, unsafeSource) => {
      const result = findForbiddenLegacyWriteSurfaces(
        sources(
          ["src/main.tsx", 'import "./features/unsafe";'],
          ["src/features/unsafe.ts", unsafeSource],
          [target, `export function ${name}(): void {}`],
        ),
        roots,
      );

      expect(result).toContain(
        `src/features/unsafe.ts: forbidden V1 secret import ${name} from ${target}`,
      );
    },
  );

  it("rejects dynamic main-thread V1 secret access", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          'const { unlockVault } = await import("../crypto/vault");\nvoid unlockVault;',
        ],
        ["src/crypto/vault.ts", "export function unlockVault(): void {}"],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden dynamic V1 secret access unlockVault from src/crypto/vault.ts",
    );
  });

  it("rejects a static-string-aliased dynamic V1 secret import", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          'const legacyPath = "../crypto/vault";\nconst { unlockVault } = await import(legacyPath);\nvoid unlockVault;',
        ],
        ["src/crypto/vault.ts", "export function unlockVault(): void {}"],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden dynamic V1 secret access unlockVault from src/crypto/vault.ts",
    );
  });

  it("fails closed on a non-static dynamic import target", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          "declare const modulePath: string;\nvoid import(modulePath);",
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden non-static dynamic import prevents V1 boundary analysis",
    );
  });

  it("allows V1 secret imports only inside the isolated reader boundary", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./workers/legacy-v1-worker";'],
        [
          "src/workers/legacy-v1-worker.ts",
          'import "../crypto/legacy-v1-reader";',
        ],
        [
          "src/crypto/legacy-v1-reader.ts",
          'import { deriveIdentityFromEntropy } from "./identity";\nimport { unlockVault } from "./vault";\nvoid deriveIdentityFromEntropy;\nvoid unlockVault;',
        ],
        [
          "src/crypto/identity.ts",
          "export function deriveIdentityFromEntropy(): void {}",
        ],
        ["src/crypto/vault.ts", "export function unlockVault(): void {}"],
      ),
      roots,
    );

    expect(result).toEqual([]);
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

  it.each([
    [
      "unrecognized named import",
      'import { wrappedOperation } from "../crypto/text";\nvoid wrappedOperation;',
      "forbidden unrecognized static V1 import wrappedOperation from src/crypto/text.ts",
    ],
    [
      "default import",
      'import legacyApi from "../crypto/text";\nvoid legacyApi;',
      "forbidden default V1 import from src/crypto/text.ts",
    ],
    [
      "side-effect import",
      'import "../crypto/text";',
      "forbidden side-effect V1 import from src/crypto/text.ts",
    ],
  ] as const)(
    "rejects a reachable legacy-module %s",
    (_label, unsafeSource, expected) => {
      const result = findForbiddenLegacyWriteSurfaces(
        sources(
          ["src/main.tsx", 'import "./features/unsafe";'],
          ["src/features/unsafe.ts", unsafeSource],
          [
            "src/crypto/text.ts",
            "export function encryptText(): void {}\nexport function decryptText(): void {}\nexport function wrappedOperation(): void {}\nexport default {};",
          ],
        ),
        roots,
      );

      expect(result).toContain(`src/features/unsafe.ts: ${expected}`);
    },
  );

  it("rejects an unrecognized V1 runtime re-export", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/unsafe";'],
        [
          "src/features/unsafe.ts",
          'export { wrappedOperation } from "../crypto/text";',
        ],
        [
          "src/crypto/text.ts",
          "export function encryptText(): void {}\nexport function decryptText(): void {}\nexport function wrappedOperation(): void {}",
        ],
      ),
      roots,
    );

    expect(result).toContain(
      "src/features/unsafe.ts: forbidden unrecognized V1 export wrappedOperation from src/crypto/text.ts",
    );
  });

  it("allows explicit type-only imports from a legacy mixed module", () => {
    const result = findForbiddenLegacyWriteSurfaces(
      sources(
        ["src/main.tsx", 'import "./features/safe";'],
        [
          "src/features/safe.ts",
          'import type { LegacyOutput } from "../crypto/text";\nexport type Output = LegacyOutput;',
        ],
        [
          "src/crypto/text.ts",
          "export function encryptText(): void {}\nexport interface LegacyOutput {}",
        ],
      ),
      roots,
    );

    expect(result).toEqual([]);
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
