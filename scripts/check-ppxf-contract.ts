import { readFileSync } from "node:fs";

const sources = {
  types: readFileSync("src/protocol/types.ts", "utf8"),
  headerCodec: readFileSync("src/protocol/ppxf-header.ts", "utf8"),
  objectCodec: readFileSync("src/protocol/ppxf.ts", "utf8"),
  security: readFileSync("docs/security-architecture.md", "utf8"),
  protocol: readFileSync("docs/protocol-v1.md", "utf8"),
  master: readFileSync("Chat_NoControl_full_plan.md", "utf8"),
  implementation: readFileSync("docs/implementation-plan.md", "utf8"),
};

function interfaceBody(source: string, name: string): string {
  const match = source.match(
    new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`, "u"),
  );
  if (!match?.[1]) throw new Error(`Missing normative ${name} interface`);
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

function checkTypes(label: string, source: string, failures: string[]): void {
  const header = interfaceBody(source, "FileHeader");
  const manifest = interfaceBody(source, "EncryptedManifestRecord");
  const object = interfaceBody(source, "EncryptedFileObject");
  requireAll(failures, `${label} FileHeader`, header, [
    "flags: 0",
    "recipientId: Uint8Array",
    "mlKemCiphertext: Uint8Array",
    "ephemeralX25519PublicKey: Uint8Array",
    "noncePrefix: Uint8Array",
    "salt: Uint8Array",
    "declaredChunkCount: number",
    "chunkSize: 1048576",
    "totalFileLength: bigint",
  ]);
  for (const forbidden of ["filename:", "mimeHint:", "caption:"]) {
    if (header.includes(forbidden)) {
      failures.push(`${label} FileHeader exposes ${forbidden.slice(0, -1)}`);
    }
  }
  requireAll(failures, `${label} EncryptedManifestRecord`, manifest, [
    "chunkIndex: 0xffffffff",
    "plaintextLength: number",
    "ciphertext: Uint8Array",
  ]);
  requireAll(failures, `${label} EncryptedFileObject`, object, [
    "header: FileHeader",
    "chunks: ChunkRecord[]",
    "manifest: EncryptedManifestRecord",
    "checksum: Uint8Array",
  ]);
}

const failures: string[] = [];
checkTypes("source", sources.types, failures);
checkTypes("security architecture", sources.security, failures);
checkTypes("implementation plan", sources.implementation, failures);

requireAll(failures, "header codec", sources.headerCodec, [
  "PPXF_HEADER_BYTES = 884",
  "PPXF_CHUNK_BYTES = 1_048_576",
  "PPXF_FILE_MAX_BYTES = 104_857_600n",
  "writer.writeBytes(header.mlKemCiphertext)",
  "writer.writeBytes(header.ephemeralX25519PublicKey)",
]);
requireAll(failures, "object codec", sources.objectCodec, [
  "chunkIndex === 0xffff_ffff",
  "ciphertextLength !== plaintextLength + 16",
  "checksum16(bytes.subarray(0, checksumOffset))",
  "reader.requireEnd()",
]);

for (const [label, source] of [
  ["protocol", sources.protocol],
  ["master", sources.master],
] as const) {
  requireAll(failures, label, source, [
    "884 bytes",
    "0xffffffff",
    "ciphertext length",
    "18000 bytes",
    "SHA-512(canonicalHeader || allCanonicalDataRecords || canonicalTerminalRecord)[0..16)",
  ]);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("PPXF contract OK");
