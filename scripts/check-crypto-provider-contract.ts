import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as ts from "typescript-eslint-compiler";

const LEGACY_WRITE_EXPORTS = new Map<string, ReadonlySet<string>>([
  ["src/crypto/identity.ts", new Set(["createSenderSigningCapability"])],
  ["src/crypto/text.ts", new Set(["encryptText"])],
  ["src/crypto/file.ts", new Set(["encryptFile", "encryptFileToBlob"])],
  ["src/crypto/qr-text.ts", new Set(["encryptQrText"])],
  ["src/crypto/vault.ts", new Set(["lockVault"])],
  [
    "src/protocol/ppxc.ts",
    new Set([
      "createPublicContact",
      "encodePublicContact",
      "encodePublicContactQr",
    ]),
  ],
  [
    "src/protocol/ppxq.ts",
    new Set(["encodeQrMessageText", "encodeQrMessageLink"]),
  ],
  ["src/protocol/message-link.ts", new Set(["encodeMessageLink"])],
  ["src/protocol/ppxr.ts", new Set(["encodeRecoveryObject"])],
  [
    "src/protocol/ppxv.ts",
    new Set(["encodeLockedVault", "encodeLockedVaultHeader"]),
  ],
]);

const DORMANT_LEGACY_IMPLEMENTATION_MODULES = new Set([
  ...LEGACY_WRITE_EXPORTS.keys(),
  "src/protocol/ppxf-manifest.ts",
  "src/protocol/ppxt-inner.ts",
]);

const READ_ONLY_LEGACY_IMPORT_EXCEPTIONS = new Map<string, ReadonlySet<string>>(
  [["src/storage/vault-migration-v2.ts", new Set(["encodeLockedVault"])]],
);

const ALLOWED_LEGACY_WORKER_KINDS = new Set([
  "decrypt-compact-v1",
  "decrypt-text-v1",
  "decrypt-file-v1",
  "migrate-recovery-v1",
  "migrate-vault-v1",
  "cancel",
]);

function requireAll(
  failures: string[],
  label: string,
  source: string,
  required: readonly string[],
): void {
  const missing = required.filter((value) => !source.includes(value));
  if (missing.length > 0)
    failures.push(`${label}: missing ${missing.join(", ")}`);
}

function normalized(path: string): string {
  return posix.normalize(path.replaceAll("\\", "/"));
}

function resolveSourceImport(
  fromPath: string,
  specifier: string,
  sources: ReadonlyMap<string, string>,
): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = normalized(posix.join(posix.dirname(fromPath), specifier));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
  if (base.endsWith(".js")) {
    candidates.push(`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`);
  }
  return candidates.find((candidate) => sources.has(candidate));
}

function sourceFile(path: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function directDependencies(
  path: string,
  source: string,
  sources: ReadonlyMap<string, string>,
): string[] {
  const dependencies = new Set<string>();
  const parsed = sourceFile(path, source);
  const addSpecifier = (value: ts.Expression | undefined) => {
    if (!value || !ts.isStringLiteralLike(value)) return;
    const resolved = resolveSourceImport(path, value.text, sources);
    if (resolved) dependencies.add(resolved);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      addSpecifier(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return [...dependencies];
}

function reachableSources(
  sources: ReadonlyMap<string, string>,
  roots: readonly string[],
): Set<string> {
  const reachable = new Set<string>();
  const pending = roots.filter((root) => sources.has(root));
  while (pending.length > 0) {
    const path = pending.pop() as string;
    if (reachable.has(path)) continue;
    reachable.add(path);
    const source = sources.get(path);
    if (source === undefined) continue;
    for (const dependency of directDependencies(path, source, sources)) {
      if (!reachable.has(dependency)) pending.push(dependency);
    }
  }
  return reachable;
}

function isForbiddenLegacyWriteName(name: string): boolean {
  if (!/(?:legacy|v1)/iu.test(name)) return false;
  return (
    /(?:encrypt|send|persist|save|store)/iu.test(name) ||
    (/(?:create)/iu.test(name) && /contact/iu.test(name))
  );
}

function importedName(
  element: ts.ImportSpecifier | ts.ExportSpecifier,
): string {
  return (element.propertyName ?? element.name).text;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAwaitExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function dynamicImportTarget(
  expression: ts.Expression,
  fromPath: string,
  sources: ReadonlyMap<string, string>,
): string | undefined {
  const candidate = unwrapExpression(expression);
  if (
    !ts.isCallExpression(candidate) ||
    candidate.expression.kind !== ts.SyntaxKind.ImportKeyword
  ) {
    return undefined;
  }
  const specifier = candidate.arguments[0];
  return specifier && ts.isStringLiteralLike(specifier)
    ? resolveSourceImport(fromPath, specifier.text, sources)
    : undefined;
}

function bindingImportedName(element: ts.BindingElement): string | undefined {
  const name = element.propertyName ?? element.name;
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : undefined;
}

function inspectReachableSource(
  path: string,
  source: string,
  sources: ReadonlyMap<string, string>,
): string[] {
  const failures: string[] = [];
  const parsed = sourceFile(path, source);
  const isDormantLegacyImplementation =
    DORMANT_LEGACY_IMPLEMENTATION_MODULES.has(path);

  const reportDynamicAccess = (target: string, name: string): void => {
    if (LEGACY_WRITE_EXPORTS.get(target)?.has(name)) {
      failures.push(
        `${path}: forbidden dynamic V1 write access ${name} from ${target}`,
      );
    }
  };

  const reportDynamicNamespaceExposure = (target: string): void => {
    if (LEGACY_WRITE_EXPORTS.has(target)) {
      failures.push(
        `${path}: forbidden dynamic V1 namespace exposure from ${target}`,
      );
    }
  };

  const inspectBinding = (
    binding: ts.ObjectBindingPattern,
    target: string,
  ): void => {
    for (const element of binding.elements) {
      const name = bindingImportedName(element);
      if (element.dotDotDotToken || !name) {
        reportDynamicNamespaceExposure(target);
      } else {
        reportDynamicAccess(target, name);
      }
    }
  };

  const inspectDynamicNamespaceUse = (
    node: ts.Node,
    namespace: string,
    target: string,
  ): void => {
    const scan = (candidate: ts.Node): void => {
      if (ts.isIdentifier(candidate) && candidate.text === namespace) {
        const parent = candidate.parent;
        if (
          ts.isPropertyAccessExpression(parent) &&
          parent.expression === candidate
        ) {
          reportDynamicAccess(target, parent.name.text);
        } else if (
          ts.isElementAccessExpression(parent) &&
          parent.expression === candidate
        ) {
          if (
            parent.argumentExpression &&
            ts.isStringLiteralLike(parent.argumentExpression)
          ) {
            reportDynamicAccess(target, parent.argumentExpression.text);
          } else {
            reportDynamicNamespaceExposure(target);
          }
        } else if (
          ts.isVariableDeclaration(parent) &&
          parent.initializer === candidate &&
          ts.isObjectBindingPattern(parent.name)
        ) {
          inspectBinding(parent.name, target);
        } else if (ts.isParameter(parent) && parent.name === candidate) {
          // The callback parameter introduces the namespace binding.
        } else {
          reportDynamicNamespaceExposure(target);
        }
      }
      ts.forEachChild(candidate, scan);
    };
    scan(node);
  };

  const visit = (node: ts.Node): void => {
    if (
      !isDormantLegacyImplementation &&
      ts.isVariableDeclaration(node) &&
      node.initializer
    ) {
      const target = dynamicImportTarget(node.initializer, path, sources);
      if (target && ts.isObjectBindingPattern(node.name)) {
        inspectBinding(node.name, target);
      } else if (target && ts.isIdentifier(node.name)) {
        reportDynamicNamespaceExposure(target);
      }
    }

    if (
      !isDormantLegacyImplementation &&
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node))
    ) {
      const target = dynamicImportTarget(node.expression, path, sources);
      if (target) {
        if (ts.isPropertyAccessExpression(node)) {
          reportDynamicAccess(target, node.name.text);
        } else if (
          node.argumentExpression &&
          ts.isStringLiteralLike(node.argumentExpression)
        ) {
          reportDynamicAccess(target, node.argumentExpression.text);
        } else {
          reportDynamicNamespaceExposure(target);
        }
      }
    }

    if (
      !isDormantLegacyImplementation &&
      ts.isReturnStatement(node) &&
      node.expression
    ) {
      const target = dynamicImportTarget(node.expression, path, sources);
      if (target) reportDynamicNamespaceExposure(target);
    }

    if (
      !isDormantLegacyImplementation &&
      ts.isArrowFunction(node) &&
      !ts.isBlock(node.body)
    ) {
      const target = dynamicImportTarget(node.body, path, sources);
      if (target) reportDynamicNamespaceExposure(target);
    }

    if (!isDormantLegacyImplementation && ts.isCallExpression(node)) {
      for (const argument of node.arguments) {
        const target = dynamicImportTarget(argument, path, sources);
        if (target) reportDynamicNamespaceExposure(target);
      }
    }

    if (
      !isDormantLegacyImplementation &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "then"
    ) {
      const target = dynamicImportTarget(
        node.expression.expression,
        path,
        sources,
      );
      const callback = node.arguments[0];
      if (
        target &&
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
      ) {
        const parameter = callback.parameters[0]?.name;
        if (parameter && ts.isIdentifier(parameter)) {
          inspectDynamicNamespaceUse(callback.body, parameter.text, target);
        } else if (parameter && ts.isObjectBindingPattern(parameter)) {
          inspectBinding(parameter, target);
        } else {
          reportDynamicNamespaceExposure(target);
        }
      } else if (target) {
        reportDynamicNamespaceExposure(target);
      }
    }

    if (
      ts.isPropertySignature(node) ||
      ts.isPropertyAssignment(node) ||
      ts.isPropertyDeclaration(node)
    ) {
      const name = node.name;
      const initializer = "initializer" in node ? node.initializer : undefined;
      if (
        name &&
        ((ts.isIdentifier(name) && name.text === "kind") ||
          (ts.isStringLiteralLike(name) && name.text === "kind")) &&
        initializer &&
        ts.isStringLiteralLike(initializer) &&
        /^(?:encrypt|send|create|persist|save|store).*-v1$/iu.test(
          initializer.text,
        ) &&
        !ALLOWED_LEGACY_WORKER_KINDS.has(initializer.text)
      ) {
        failures.push(
          `${path}: forbidden V1 worker request kind ${initializer.text}`,
        );
      }
    }

    if (!isDormantLegacyImplementation && ts.isIdentifier(node)) {
      const parent = node.parent;
      const isDeclaredOrCalledSurface =
        (ts.isFunctionDeclaration(parent) && parent.name === node) ||
        (ts.isClassDeclaration(parent) && parent.name === node) ||
        (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
        (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
        (ts.isVariableDeclaration(parent) && parent.name === node) ||
        (ts.isCallExpression(parent) && parent.expression === node);
      if (isDeclaredOrCalledSurface && isForbiddenLegacyWriteName(node.text)) {
        failures.push(`${path}: forbidden V1 write surface ${node.text}`);
      }
    }

    if (
      !isDormantLegacyImplementation &&
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const target = resolveSourceImport(
        path,
        node.moduleSpecifier.text,
        sources,
      );
      const forbidden = target ? LEGACY_WRITE_EXPORTS.get(target) : undefined;
      if (target && forbidden) {
        if (ts.isImportDeclaration(node)) {
          const bindings = node.importClause?.namedBindings;
          if (bindings && ts.isNamespaceImport(bindings)) {
            failures.push(
              `${path}: namespace import exposes V1 write symbols from ${target}`,
            );
          } else if (bindings && ts.isNamedImports(bindings)) {
            for (const element of bindings.elements) {
              const name = importedName(element);
              const allowed = READ_ONLY_LEGACY_IMPORT_EXCEPTIONS.get(path);
              if (forbidden.has(name) && !allowed?.has(name)) {
                failures.push(
                  `${path}: forbidden V1 write import ${name} from ${target}`,
                );
              }
            }
          }
        } else if (!node.exportClause) {
          failures.push(
            `${path}: wildcard export exposes V1 write symbols from ${target}`,
          );
        } else if (ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            const name = importedName(element);
            if (forbidden.has(name)) {
              failures.push(
                `${path}: forbidden V1 write export ${name} from ${target}`,
              );
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return [...new Set(failures)];
}

export function findForbiddenLegacyWriteSurfaces(
  sources: ReadonlyMap<string, string>,
  roots: readonly string[],
): string[] {
  const failures: string[] = [];
  for (const path of reachableSources(sources, roots)) {
    const source = sources.get(path);
    if (source !== undefined) {
      failures.push(...inspectReachableSource(path, source, sources));
    }
  }
  return [...new Set(failures)].sort();
}

function loadSourceTree(root: string): Map<string, string> {
  const sources = new Map<string, string>();
  const walk = (directory: string): void => {
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const relativePath = normalized(join(directory, entry.name));
      if (entry.isDirectory()) {
        if (relativePath !== "src/tests") walk(relativePath);
      } else if (/\.(?:ts|tsx)$/u.test(entry.name)) {
        sources.set(
          relativePath,
          readFileSync(join(root, relativePath), "utf8"),
        );
      }
    }
  };
  walk("src");
  return sources;
}

function runProviderContract(root: string): string[] {
  const read = (path: string) => readFileSync(join(root, path), "utf8");
  const files = {
    types: read("src/protocol/types-v2.ts"),
    provider: read("src/crypto/provider.ts"),
    defaultProvider: read("src/crypto/default-provider.ts"),
    text: read("src/crypto/text-v2.ts"),
    file: read("src/crypto/file-v2.ts"),
    encryptFlow: read("src/flows/encrypt/text.tsx"),
    decryptFlow: read("src/flows/decrypt/index.tsx"),
    cryptoRunner: read("src/workers/crypto-runner.ts"),
    fileRunner: read("src/workers/file-runner.ts"),
    contactsFlow: read("src/flows/contacts/manage.tsx"),
  };
  const legacyFiles = {
    reader: read("src/crypto/legacy-v1-reader.ts"),
    contracts: read("src/workers/legacy-v1-contracts.ts"),
    runner: read("src/workers/legacy-v1-runner.ts"),
    client: read("src/workers/legacy-v1-client.ts"),
  };
  const failures: string[] = [];

  requireAll(failures, "V2 wire types", files.types, [
    "PPX_V2_FORMAT_VERSION = 0x02",
    "PPX_PQ_5_SUITE = 0x02",
    'PPX_PQ_5_NAME = "PPX-PQ-5"',
    "kemPublicKey: Uint8Array",
    "kemSecretKey: Uint8Array",
    "signingPublicKey: Uint8Array",
    "signingSecretKey: Uint8Array",
    "mlKemCiphertext: Uint8Array",
    "senderSigningCapability: SenderSigningCapabilityV2",
    "activeIdentity: DecapsulationCapabilityV2",
    "knownSenders: readonly PublicContactV2[]",
  ]);
  requireAll(failures, "provider", files.provider, [
    "deriveIdentity(",
    "createPublicContact(",
    "parsePublicContact(",
    "encryptText(input: EncryptTextInputV2)",
    "decryptText(input: DecryptTextInputV2)",
    "lockVault(input: LockVaultInputV2)",
    "unlockVault(input: UnlockVaultInputV2)",
  ]);
  requireAll(failures, "default provider", files.defaultProvider, [
    "deriveIdentityV2FromEntropy",
    "createPublicContactV2",
    "parsePublicContactV2",
    "encryptTextV2",
    "decryptTextV2",
    "lockVaultV2",
    "unlockVaultV2",
  ]);
  requireAll(failures, "text cryptography", files.text, [
    "ObjectFamilyV2.Text",
    "ObjectFamilyV2.CompactText",
    "encryptAesGcm",
    "decryptAesGcm",
  ]);
  requireAll(failures, "file cryptography", files.file, [
    "ObjectFamilyV2.File",
    "PPX_PQ_5_SUITE",
    "aes256Key",
    "encryptAesGcm",
    "decryptAesGcm",
  ]);
  requireAll(failures, "encrypt UI", files.encryptFlow, [
    "startEncryptTextJob",
    "createSenderSigningCapabilityV2",
    "encodeTextArmorV2",
    "encodeMessageLinkV2",
  ]);
  requireAll(failures, "decrypt UI", files.decryptFlow, [
    "startDecryptTextJob",
    "createDecapsulationCapabilityV2",
  ]);
  requireAll(failures, "crypto runner", files.cryptoRunner, [
    "validateSenderSigningCapabilityV2",
    "validateDecapsulationCapabilityV2",
    "defaultCryptoProvider.encryptText",
    "defaultCryptoProvider.decryptText",
    "defaultCryptoProvider.lockVault",
    "defaultCryptoProvider.unlockVault",
  ]);
  requireAll(failures, "file runner", files.fileRunner, [
    "encryptFileToBlobV2",
    "decryptFileV2",
    "validateSenderSigningCapabilityV2",
    "validateDecapsulationCapabilityV2",
  ]);
  requireAll(failures, "contact import", files.contactsFlow, [
    "parsePublicContactV2",
    "encodePublicContactV2",
  ]);
  requireAll(failures, "isolated V1 reader", legacyFiles.reader, [
    "decryptLegacyCompactTextV1",
    "decryptLegacyTextV1",
    "decryptLegacyFileV1",
    "migrateLegacyRecoveryV1",
    "migrateLegacyVaultV1",
    "zeroize",
  ]);
  requireAll(failures, "V1 worker contract", legacyFiles.contracts, [
    'kind: "decrypt-compact-v1"',
    'kind: "decrypt-text-v1"',
    'kind: "decrypt-file-v1"',
    'kind: "migrate-recovery-v1"',
    'kind: "migrate-vault-v1"',
    'kind: "cancel"',
  ]);
  requireAll(failures, "V1 worker runner", legacyFiles.runner, [
    "decryptLegacyCompactTextV1",
    "decryptLegacyTextV1",
    "decryptLegacyFileV1",
    "migrateLegacyRecoveryV1",
    "migrateLegacyVaultV1",
    "releaseRequestSecrets",
  ]);
  requireAll(failures, "V1 worker client", legacyFiles.client, [
    "startLegacyCompactTextDecryptJob",
    "startLegacyTextDecryptJob",
    "startLegacyFileDecryptJob",
    "startLegacyRecoveryMigrationJob",
    "startLegacyVaultMigrationJob",
    "releaseRequestSecrets",
  ]);

  for (const [label, source] of Object.entries(files)) {
    for (const forbidden of [
      "createHybridEncapsulation",
      "x25519",
      "X25519",
      "PPXQ",
      "startEncryptQrTextJob",
      "startDecryptQrTextJob",
    ]) {
      if (source.includes(forbidden))
        failures.push(`${label}: forbidden ${forbidden}`);
    }
  }

  const sourceTree = loadSourceTree(root);
  const roots = [
    "src/main.tsx",
    "src/sw.ts",
    ...[...sourceTree.keys()].filter((path) =>
      /^src\/workers\/.*-worker\.ts$/u.test(path),
    ),
  ];
  failures.push(...findForbiddenLegacyWriteSurfaces(sourceTree, roots));
  return [...new Set(failures)].sort();
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) {
  const root = resolve(dirname(process.argv[1] as string), "..");
  const failures = runProviderContract(root);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("Cat-5 CryptoProvider contract OK");
}
