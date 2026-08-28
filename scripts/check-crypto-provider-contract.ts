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

const LEGACY_DYNAMIC_READ_EXPORTS = new Map<string, ReadonlySet<string>>([
  ["src/crypto/identity.ts", new Set(["deriveIdentityFromEntropy"])],
  ["src/crypto/text.ts", new Set(["decryptText"])],
  ["src/crypto/file.ts", new Set(["decryptFile"])],
  ["src/crypto/qr-text.ts", new Set(["decryptQrText"])],
  ["src/crypto/vault.ts", new Set(["unlockVault"])],
  [
    "src/protocol/ppxc.ts",
    new Set([
      "parsePublicContact",
      "parsePublicContactQr",
      "PPXC_MAXIMUM_BASE45_CHARS",
      "PPXC_MAXIMUM_SIZE",
    ]),
  ],
  [
    "src/protocol/ppxq.ts",
    new Set(["extractQrMessageBytes", "parseQrMessageText"]),
  ],
  [
    "src/protocol/message-link.ts",
    new Set([
      "captureIncomingEncryptedIntent",
      "captureIncomingMessageIntent",
      "isReservedIncomingEncryptedHash",
      "isReservedMessageLinkHash",
      "parseMessageLinkHash",
    ]),
  ],
  [
    "src/protocol/ppxr.ts",
    new Set(["parseRecoveryObject", "PPXR_MAXIMUM_BASE45_CHARS"]),
  ],
  [
    "src/protocol/ppxv.ts",
    new Set([
      "parseLockedVault",
      "PPXV_MAXIMUM_BASE45_CHARS",
      "PPXV_MAXIMUM_SIZE",
    ]),
  ],
]);

const LEGACY_SECRET_EXPORTS = new Map<string, ReadonlySet<string>>([
  ["src/crypto/identity.ts", new Set(["deriveIdentityFromEntropy"])],
  ["src/crypto/vault.ts", new Set(["unlockVault"])],
]);

const ALLOWED_LEGACY_SECRET_IMPORTS = new Map<
  string,
  ReadonlyMap<string, ReadonlySet<string>>
>([
  [
    "src/crypto/legacy-v1-reader.ts",
    new Map([
      ["src/crypto/identity.ts", new Set(["deriveIdentityFromEntropy"])],
      ["src/crypto/vault.ts", new Set(["unlockVault"])],
    ]),
  ],
  [
    "src/crypto/vault.ts",
    new Map([
      ["src/crypto/identity.ts", new Set(["deriveIdentityFromEntropy"])],
    ]),
  ],
]);

const FORBIDDEN_REACHABLE_LEGACY_MODULES = new Map<string, string>([
  [
    "src/components/qr/message.ts",
    "forbidden reachable legacy message-QR writer module",
  ],
]);

const FORBIDDEN_MESSAGE_QR_WRITER_NAMES = new Set([
  "prepareMessageQr",
  "generateMessageQrPng",
]);

const DORMANT_LEGACY_IMPLEMENTATION_MODULES = new Set([
  ...LEGACY_WRITE_EXPORTS.keys(),
  "src/protocol/ppxf-manifest.ts",
  "src/protocol/ppxt-inner.ts",
]);

const READ_ONLY_LEGACY_IMPORT_EXCEPTIONS = new Map<string, ReadonlySet<string>>(
  [
    ["src/storage/vault-migration-v2.ts", new Set(["encodeLockedVault"])],
    ["src/flows/decrypt/index.tsx", new Set(["encodePublicContact"])],
  ],
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
  const stringBindings = collectStaticStringBindings(parsed);
  const addSpecifier = (value: ts.Expression | undefined) => {
    if (!value) return;
    const specifier = staticExpressionName(value, stringBindings);
    if (!specifier) return;
    const resolved = resolveSourceImport(path, specifier, sources);
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
    /(?:encrypt|send(?!er)|persist|save|store|write|publish)/iu.test(name) ||
    /(?:create|add|insert|put|record|upsert).*(?:legacy|v1).*contact/iu.test(
      name,
    ) ||
    /(?:legacy|v1).*contact.*(?:create|add|insert|put|record|upsert)/iu.test(
      name,
    )
  );
}

function isForbiddenCat5DowngradeName(name: string): boolean {
  return (
    /downgrade.*(?:legacy|v1)/iu.test(name) ||
    /(?:cat5|v2).*to(?:legacy|v1)/iu.test(name) ||
    /(?:convert|migrate).*to(?:legacy|v1)/iu.test(name)
  );
}

function isForbiddenLegacyWorkerKind(kind: string): boolean {
  if (ALLOWED_LEGACY_WORKER_KINDS.has(kind)) return false;
  return (
    /^(?:encrypt|send|create|persist|save|store|write|encode).*-v1$/iu.test(
      kind,
    ) ||
    /^(?:downgrade|convert).*(?:legacy|v1)$/iu.test(kind) ||
    /(?:cat5|v2)-(?:to|as)-(?:legacy|v1)$/iu.test(kind)
  );
}

function staticExpressionName(
  expression: ts.Expression,
  stringBindings: ReadonlyMap<string, string>,
): string | undefined {
  const candidate = unwrapExpression(expression);
  if (ts.isStringLiteralLike(candidate) || ts.isNumericLiteral(candidate)) {
    return candidate.text;
  }
  if (ts.isIdentifier(candidate)) return stringBindings.get(candidate.text);
  if (
    ts.isBinaryExpression(candidate) &&
    candidate.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticExpressionName(candidate.left, stringBindings);
    const right = staticExpressionName(candidate.right, stringBindings);
    return left !== undefined && right !== undefined ? left + right : undefined;
  }
  return undefined;
}

function staticPropertyName(
  name: ts.PropertyName,
  stringBindings: ReadonlyMap<string, string>,
): string | undefined {
  return ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : ts.isComputedPropertyName(name)
      ? staticExpressionName(name.expression, stringBindings)
      : undefined;
}

function collectStaticStringBindings(root: ts.Node): Map<string, string> {
  const stringBindings = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const value = staticExpressionName(node.initializer, stringBindings);
      if (value !== undefined) stringBindings.set(node.name.text, value);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return stringBindings;
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
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function dynamicImportTarget(
  expression: ts.Expression,
  fromPath: string,
  sources: ReadonlyMap<string, string>,
  stringBindings: ReadonlyMap<string, string>,
): string | undefined {
  const candidate = unwrapExpression(expression);
  if (
    !ts.isCallExpression(candidate) ||
    candidate.expression.kind !== ts.SyntaxKind.ImportKeyword
  ) {
    return undefined;
  }
  const specifier = candidate.arguments[0];
  const specifierText = specifier
    ? staticExpressionName(specifier, stringBindings)
    : undefined;
  return specifierText
    ? resolveSourceImport(fromPath, specifierText, sources)
    : undefined;
}

function bindingImportedName(element: ts.BindingElement): string | undefined {
  const name = element.propertyName ?? element.name;
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : undefined;
}

function isCallableComputedSurface(
  node:
    | ts.MethodDeclaration
    | ts.MethodSignature
    | ts.GetAccessorDeclaration
    | ts.SetAccessorDeclaration
    | ts.PropertyAssignment
    | ts.PropertyDeclaration
    | ts.PropertySignature,
): boolean {
  if (
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  ) {
    return true;
  }
  if (ts.isPropertySignature(node)) {
    return Boolean(node.type && ts.isFunctionTypeNode(node.type));
  }
  return Boolean(
    node.initializer &&
    (ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer)),
  );
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
  const stringBindings = collectStaticStringBindings(parsed);

  const isAllowedSecretImport = (target: string, name: string): boolean =>
    ALLOWED_LEGACY_SECRET_IMPORTS.get(path)?.get(target)?.has(name) ?? false;

  const reportForbiddenSurface = (name: string): void => {
    if (FORBIDDEN_MESSAGE_QR_WRITER_NAMES.has(name)) {
      failures.push(`${path}: forbidden message-QR writer surface ${name}`);
    } else if (isForbiddenCat5DowngradeName(name)) {
      failures.push(`${path}: forbidden CAT5-to-V1 downgrade surface ${name}`);
    } else if (isForbiddenLegacyWriteName(name)) {
      failures.push(`${path}: forbidden V1 write surface ${name}`);
    }
  };

  const reportDynamicAccess = (target: string, name: string): void => {
    if (LEGACY_WRITE_EXPORTS.get(target)?.has(name)) {
      failures.push(
        `${path}: forbidden dynamic V1 write access ${name} from ${target}`,
      );
    } else if (
      LEGACY_SECRET_EXPORTS.get(target)?.has(name) &&
      !isAllowedSecretImport(target, name)
    ) {
      failures.push(
        `${path}: forbidden dynamic V1 secret access ${name} from ${target}`,
      );
    } else if (!LEGACY_DYNAMIC_READ_EXPORTS.get(target)?.has(name)) {
      failures.push(
        `${path}: forbidden unrecognized dynamic V1 access ${name} from ${target}`,
      );
    }
  };

  const reportDynamicNamespaceExposure = (target: string): void => {
    if (LEGACY_WRITE_EXPORTS.has(target) || LEGACY_SECRET_EXPORTS.has(target)) {
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

  const isAllowedDynamicImportContext = (node: ts.CallExpression): boolean => {
    let expression: ts.Expression = node;
    while (
      (ts.isAwaitExpression(expression.parent) ||
        ts.isParenthesizedExpression(expression.parent)) &&
      expression.parent.expression === expression
    ) {
      expression = expression.parent;
    }
    const parent = expression.parent;
    if (
      ts.isVariableDeclaration(parent) &&
      parent.initializer === expression &&
      ts.isObjectBindingPattern(parent.name)
    ) {
      return true;
    }
    if (
      ts.isPropertyAccessExpression(parent) &&
      parent.expression === expression
    ) {
      return true;
    }
    if (
      ts.isElementAccessExpression(parent) &&
      parent.expression === expression
    ) {
      return Boolean(
        parent.argumentExpression &&
        ts.isStringLiteralLike(parent.argumentExpression),
      );
    }
    return false;
  };

  const visit = (node: ts.Node): void => {
    if (
      !isDormantLegacyImplementation &&
      (ts.isMethodDeclaration(node) ||
        ts.isMethodSignature(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isPropertyAssignment(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isPropertySignature(node))
    ) {
      const name = staticPropertyName(node.name, stringBindings);
      if (name) {
        reportForbiddenSurface(name);
      } else if (
        ts.isComputedPropertyName(node.name) &&
        isCallableComputedSurface(node)
      ) {
        failures.push(
          `${path}: forbidden non-static computed surface prevents V1 boundary analysis`,
        );
      }
    }

    if (!isDormantLegacyImplementation && ts.isPropertyAccessExpression(node)) {
      reportForbiddenSurface(node.name.text);
    }

    if (
      !isDormantLegacyImplementation &&
      ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      staticExpressionName(node.argumentExpression, stringBindings) !==
        undefined
    ) {
      reportForbiddenSurface(
        staticExpressionName(node.argumentExpression, stringBindings) as string,
      );
    }

    if (
      !isDormantLegacyImplementation &&
      ts.isBindingElement(node) &&
      ts.isObjectBindingPattern(node.parent)
    ) {
      const name = node.propertyName
        ? staticPropertyName(node.propertyName, stringBindings)
        : ts.isIdentifier(node.name)
          ? node.name.text
          : undefined;
      if (name) {
        reportForbiddenSurface(name);
      } else if (
        node.propertyName &&
        ts.isComputedPropertyName(node.propertyName)
      ) {
        failures.push(
          `${path}: forbidden non-static computed surface prevents V1 boundary analysis`,
        );
      }
    }

    if (
      !isDormantLegacyImplementation &&
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const target = dynamicImportTarget(node, path, sources, stringBindings);
      if (!target) {
        const specifier = node.arguments[0];
        const specifierText = specifier
          ? staticExpressionName(specifier, stringBindings)
          : undefined;
        if (!specifierText) {
          failures.push(
            `${path}: forbidden non-static dynamic import prevents V1 boundary analysis`,
          );
        }
      }
      if (
        target &&
        (LEGACY_WRITE_EXPORTS.has(target) ||
          LEGACY_SECRET_EXPORTS.has(target)) &&
        !isAllowedDynamicImportContext(node)
      ) {
        reportDynamicNamespaceExposure(target);
      }
    }

    if (
      !isDormantLegacyImplementation &&
      ts.isVariableDeclaration(node) &&
      node.initializer
    ) {
      const target = dynamicImportTarget(
        node.initializer,
        path,
        sources,
        stringBindings,
      );
      if (target && ts.isObjectBindingPattern(node.name)) {
        inspectBinding(node.name, target);
      }
    }

    if (
      !isDormantLegacyImplementation &&
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node))
    ) {
      const target = dynamicImportTarget(
        node.expression,
        path,
        sources,
        stringBindings,
      );
      if (target) {
        if (ts.isPropertyAccessExpression(node)) {
          if (
            node.name.text !== "then" ||
            !ts.isCallExpression(node.parent) ||
            node.parent.expression !== node
          ) {
            reportDynamicAccess(target, node.name.text);
          }
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
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "then"
    ) {
      const target = dynamicImportTarget(
        node.expression.expression,
        path,
        sources,
        stringBindings,
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
        isForbiddenLegacyWorkerKind(initializer.text)
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
        (ts.isFunctionExpression(parent) && parent.name === node) ||
        (ts.isClassDeclaration(parent) && parent.name === node) ||
        (ts.isClassExpression(parent) && parent.name === node) ||
        (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
        (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
        (ts.isVariableDeclaration(parent) && parent.name === node) ||
        (ts.isCallExpression(parent) && parent.expression === node);
      if (
        isDeclaredOrCalledSurface &&
        (isForbiddenLegacyWriteName(node.text) ||
          isForbiddenCat5DowngradeName(node.text) ||
          FORBIDDEN_MESSAGE_QR_WRITER_NAMES.has(node.text))
      ) {
        reportForbiddenSurface(node.text);
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
      const secret = target ? LEGACY_SECRET_EXPORTS.get(target) : undefined;
      if (target && (forbidden || secret)) {
        if (ts.isImportDeclaration(node)) {
          if (node.importClause?.isTypeOnly) {
            return;
          }
          if (!node.importClause) {
            failures.push(
              `${path}: forbidden side-effect V1 import from ${target}`,
            );
          } else if (node.importClause.name) {
            failures.push(
              `${path}: forbidden default V1 import from ${target}`,
            );
          }
          const bindings = node.importClause?.namedBindings;
          if (bindings && ts.isNamespaceImport(bindings)) {
            failures.push(
              `${path}: namespace import exposes V1 write symbols from ${target}`,
            );
          } else if (bindings && ts.isNamedImports(bindings)) {
            for (const element of bindings.elements) {
              if (element.isTypeOnly) continue;
              const name = importedName(element);
              const allowed = READ_ONLY_LEGACY_IMPORT_EXCEPTIONS.get(path);
              const writeException = allowed?.has(name) ?? false;
              if (forbidden?.has(name) && !allowed?.has(name)) {
                failures.push(
                  `${path}: forbidden V1 write import ${name} from ${target}`,
                );
              }
              if (secret?.has(name) && !isAllowedSecretImport(target, name)) {
                failures.push(
                  `${path}: forbidden V1 secret import ${name} from ${target}`,
                );
              }
              if (
                !forbidden?.has(name) &&
                !secret?.has(name) &&
                !LEGACY_DYNAMIC_READ_EXPORTS.get(target)?.has(name) &&
                !writeException
              ) {
                failures.push(
                  `${path}: forbidden unrecognized static V1 import ${name} from ${target}`,
                );
              }
            }
          }
        } else if (node.isTypeOnly) {
          // Type-only re-exports cannot expose a runtime V1 operation.
        } else if (!node.exportClause) {
          failures.push(
            `${path}: wildcard export exposes V1 write symbols from ${target}`,
          );
        } else if (ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            if (element.isTypeOnly) continue;
            const name = importedName(element);
            if (forbidden?.has(name)) {
              failures.push(
                `${path}: forbidden V1 write export ${name} from ${target}`,
              );
            }
            if (secret?.has(name)) {
              failures.push(
                `${path}: forbidden V1 secret export ${name} from ${target}`,
              );
            }
            if (
              !forbidden?.has(name) &&
              !secret?.has(name) &&
              !LEGACY_DYNAMIC_READ_EXPORTS.get(target)?.has(name)
            ) {
              failures.push(
                `${path}: forbidden unrecognized V1 export ${name} from ${target}`,
              );
            }
          }
        } else {
          failures.push(
            `${path}: namespace export exposes V1 symbols from ${target}`,
          );
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
    const forbiddenModule = FORBIDDEN_REACHABLE_LEGACY_MODULES.get(path);
    if (forbiddenModule) failures.push(`${path}: ${forbiddenModule}`);
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
    worker: read("src/workers/legacy-v1-worker.ts"),
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
    "legacyV1RequestTransferList",
    "legacyV1EventTransferList",
    "zeroizeLegacyV1TransferList",
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
    "legacyV1RequestTransferList",
  ]);
  requireAll(failures, "V1 worker transport", legacyFiles.worker, [
    "legacyV1EventTransferList",
    "zeroizeLegacyV1TransferList",
    "scope.postMessage(event, transferList)",
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
