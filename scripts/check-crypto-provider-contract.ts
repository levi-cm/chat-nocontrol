import { readFileSync } from "node:fs";

const files = {
  types: readFileSync("src/protocol/types.ts", "utf8"),
  provider: readFileSync("src/crypto/provider.ts", "utf8"),
  defaultProvider: readFileSync("src/crypto/default-provider.ts", "utf8"),
  hybrid: readFileSync("src/crypto/hybrid.ts", "utf8"),
  encryptFlow: readFileSync("src/flows/encrypt/text.tsx", "utf8"),
  decryptFlow: readFileSync("src/flows/decrypt/index.tsx", "utf8"),
  cryptoRunner: readFileSync("src/workers/crypto-runner.ts", "utf8"),
  fileRunner: readFileSync("src/workers/file-runner.ts", "utf8"),
  contactsFlow: readFileSync("src/flows/contacts/manage.tsx", "utf8"),
  architecture: readFileSync("docs/security-architecture.md", "utf8"),
  implementation: readFileSync("docs/implementation-plan.md", "utf8"),
};

function interfaceBody(source: string, name: string): string {
  const match = source.match(
    new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`, "u"),
  );
  if (!match?.[1]) throw new Error(`Missing ${name}`);
  return match[1];
}

function requireAll(
  failures: string[],
  label: string,
  source: string,
  required: string[],
): void {
  const missing = required.filter((value) => !source.includes(value));
  if (missing.length > 0)
    failures.push(`${label}: missing ${missing.join(", ")}`);
}

const failures: string[] = [];
const capability = interfaceBody(files.types, "SenderSigningCapability");
const textInput = interfaceBody(files.types, "EncryptTextInput");
const fileInput = interfaceBody(files.types, "EncryptFileInput");
requireAll(failures, "SenderSigningCapability", capability, [
  "fingerprint: Uint8Array",
  "signingPublicKey: Uint8Array",
  "signingSecretKey: Uint8Array",
]);
requireAll(failures, "EncryptTextInput", textInput, [
  "sender: PublicContact",
  "senderSigningCapability: SenderSigningCapability",
  "recipient: PublicContact",
]);
requireAll(failures, "EncryptFileInput", fileInput, [
  "sender: PublicContact",
  "senderSigningCapability: SenderSigningCapability",
  "recipient: PublicContact",
]);

for (const [label, source] of [
  ["provider source", files.provider],
  ["security architecture", files.architecture],
  ["implementation plan", files.implementation],
] as const) {
  requireAll(failures, label, source, [
    "recipientFingerprint: Uint8Array",
    "recipientKemPublicKey: Uint8Array",
    "recipientX25519PublicKey: Uint8Array",
    "encryptText(input: EncryptTextInput)",
    "encryptFile(",
    "encryptFileToBlob(",
  ]);
  const providerBlock = source.slice(
    source.indexOf("createHybridEncapsulation(params:"),
    source.indexOf(
      "encryptText(input:",
      source.indexOf("createHybridEncapsulation(params:"),
    ),
  );
  for (const forbidden of [
    "ephemeralX25519SecretKey",
    "ephemeralX25519PublicKey",
    "mlKemCiphertext",
    "mlKemSharedSecret",
    "x25519SharedSecret",
    "salt:",
  ]) {
    if (providerBlock.includes(forbidden)) {
      failures.push(`${label}: caller supplies forbidden ${forbidden}`);
    }
  }
}

requireAll(failures, "hybrid implementation", files.hybrid, [
  "crypto.getRandomValues(new Uint8Array(32))",
  "encapsulate: mlKem512Encapsulate",
  "sharedSecret: x25519SharedSecret",
  "primitives.encapsulate(recipient.recipientKemPublicKey)",
  "primitives.sharedSecret(",
  "zeroize(ephemeralSecret)",
]);
requireAll(failures, "default provider", files.defaultProvider, [
  "class DefaultCryptoProvider implements CryptoProvider",
  "createNobleCryptoProvider(): CryptoProvider",
  "createWebCryptoAdapter(): CryptoProvider | null",
  "return encapsulateHybrid(params)",
  "return encryptText(input)",
  "return decryptText(input)",
  "return encryptFile(input, hooks)",
  "return encryptFileToBlob(input, hooks)",
  "return decryptFile(input, hooks)",
]);
requireAll(failures, "encrypt UI worker use", files.encryptFlow, [
  "startEncryptTextJob",
]);
requireAll(failures, "decrypt UI worker use", files.decryptFlow, [
  "startDecryptTextJob",
]);
requireAll(failures, "crypto worker provider use", files.cryptoRunner, [
  "defaultCryptoProvider.encryptText",
  "defaultCryptoProvider.decryptText",
  "defaultCryptoProvider.lockVault",
  "defaultCryptoProvider.unlockVault",
]);
requireAll(failures, "file worker provider use", files.fileRunner, [
  "defaultCryptoProvider.encryptFileToBlob",
  "defaultCryptoProvider.decryptFile",
]);
requireAll(failures, "contact import provider use", files.contactsFlow, [
  "defaultCryptoProvider.parsePublicContact",
]);
if (
  files.encryptFlow.includes('from "../../crypto/text"') ||
  files.decryptFlow.includes('from "../../crypto/text"')
) {
  failures.push("text UI bypasses CryptoProvider");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("CryptoProvider contract OK");
