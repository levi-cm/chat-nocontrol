import { readFileSync } from "node:fs";

const files = {
  types: readFileSync("src/protocol/types-v2.ts", "utf8"),
  provider: readFileSync("src/crypto/provider.ts", "utf8"),
  defaultProvider: readFileSync("src/crypto/default-provider.ts", "utf8"),
  text: readFileSync("src/crypto/text-v2.ts", "utf8"),
  file: readFileSync("src/crypto/file-v2.ts", "utf8"),
  encryptFlow: readFileSync("src/flows/encrypt/text.tsx", "utf8"),
  decryptFlow: readFileSync("src/flows/decrypt/index.tsx", "utf8"),
  cryptoRunner: readFileSync("src/workers/crypto-runner.ts", "utf8"),
  fileRunner: readFileSync("src/workers/file-runner.ts", "utf8"),
  contactsFlow: readFileSync("src/flows/contacts/manage.tsx", "utf8"),
  decryptFileFlow: readFileSync("src/flows/decrypt/file.tsx", "utf8"),
};

const legacyFiles = {
  reader: readFileSync("src/crypto/legacy-v1-reader.ts", "utf8"),
  contracts: readFileSync("src/workers/legacy-v1-contracts.ts", "utf8"),
  runner: readFileSync("src/workers/legacy-v1-runner.ts", "utf8"),
  client: readFileSync("src/workers/legacy-v1-client.ts", "utf8"),
  recoveryImport: readFileSync("src/flows/identity/import.tsx", "utf8"),
};

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
  "startLegacyTextDecryptJob",
  "classifyEncryptedText",
]);
requireAll(failures, "decrypt file UI", files.decryptFileFlow, [
  "startDecryptFileJob",
  "createDecapsulationCapabilityV2",
  "startLegacyFileDecryptJob",
  "classifyEncryptedFile",
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
requireAll(failures, "legacy recovery routing", legacyFiles.recoveryImport, [
  "startLegacyRecoveryMigrationJob",
  "startLegacyVaultMigrationJob",
  "fileSuite === 1",
  "qrSuite === 1",
]);

const workerEventMarker = "export type LegacyV1WorkerEvent";
const workerEventOffset = legacyFiles.contracts.indexOf(workerEventMarker);
if (workerEventOffset < 0) {
  failures.push(`V1 worker contract: missing ${workerEventMarker}`);
}
const requestContractSource =
  workerEventOffset < 0
    ? ""
    : legacyFiles.contracts.slice(0, workerEventOffset);
const workerRequestKinds = [
  ...requestContractSource.matchAll(/kind:\s*"([^"]+)"/gu),
].map((match) => match[1] as string);
const allowedWorkerRequestKinds = new Set([
  "decrypt-compact-v1",
  "decrypt-text-v1",
  "decrypt-file-v1",
  "migrate-recovery-v1",
  "migrate-vault-v1",
  "cancel",
]);
for (const kind of workerRequestKinds) {
  if (!allowedWorkerRequestKinds.has(kind)) {
    failures.push(`V1 worker contract: forbidden request kind ${kind}`);
  }
}

for (const [label, source] of Object.entries(legacyFiles)) {
  for (const pattern of [
    /kind:\s*"(?:encrypt|send|create|persist|save|store)[^"]*-v1"/iu,
    /\b(?:encrypt|send|persist|save|store)\w*(?:V1|Legacy)\b/iu,
    /\bcreate(?:Public)?Contact\w*(?:V1|Legacy)\b/iu,
    /\bstartLegacy\w*(?:Encrypt|Send|Contact|Persist|Save|Store)\w*Job\b/u,
    /\bexport\s+(?:async\s+)?(?:function|const|class|interface|type)\s+(?=\w*(?:V1|Legacy))(?=\w*(?:Encrypt|Send|Persist|Save|Store|Contact))\w+/iu,
  ]) {
    if (pattern.test(source)) {
      failures.push(`${label}: forbidden V1 write symbol`);
    }
  }
}

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

for (const [label, source] of Object.entries({
  encryptFlow: files.encryptFlow,
  cryptoRunner: files.cryptoRunner,
  fileRunner: files.fileRunner,
  legacyContracts: legacyFiles.contracts,
  legacyRunner: legacyFiles.runner,
  legacyClient: legacyFiles.client,
})) {
  for (const forbidden of [
    "encrypt-text-v1",
    "encrypt-file-v1",
    "encrypt-contact-v1",
    "create-contact-v1",
    "encrypt-ppxq-v1",
    "create-message-link-v1",
  ]) {
    if (source.includes(forbidden))
      failures.push(`${label}: forbidden legacy write job ${forbidden}`);
  }
}

for (const [label, source] of Object.entries({
  provider: files.provider,
  defaultProvider: files.defaultProvider,
  text: files.text,
  file: files.file,
  cryptoRunner: files.cryptoRunner,
  fileRunner: files.fileRunner,
  encryptFlow: files.encryptFlow,
  contactsFlow: files.contactsFlow,
})) {
  const directV1Import =
    /from ["'][^"']*(?:crypto\/(?:identity|text|file|vault)|protocol\/(?:ppxc|ppxq|ppxr|ppxv))["'];/u;
  if (directV1Import.test(source)) {
    const directLegacyImports = source
      .split("\n")
      .filter((line) => directV1Import.test(line) && !line.includes("-v2"));
    if (directLegacyImports.length > 0)
      failures.push(`${label}: direct V1 import outside legacy boundary`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Cat-5 CryptoProvider contract OK");
