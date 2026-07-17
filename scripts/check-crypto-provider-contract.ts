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

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Cat-5 CryptoProvider contract OK");
