import { sha256 } from "@noble/hashes/sha2.js";

const SOURCE_COMMIT = "15c0f3deeefbfa8cb6cd32a99e1ca3b738c66bf0";
const BASE = `https://raw.githubusercontent.com/usnistgov/ACVP-Server/${SOURCE_COMMIT}/gen-val/json-files`;
const SOURCES = Object.freeze({
  kemKeyGen: {
    url: `${BASE}/ML-KEM-keyGen-FIPS203/internalProjection.json`,
    sha256: "d7a62a2c3476957f56dd8d24f9004ea6776ccfe995ffe71a65bb9506dc9c7b1b",
  },
  kemEncapDecap: {
    url: `${BASE}/ML-KEM-encapDecap-FIPS203/internalProjection.json`,
    sha256: "f1e22b7d399dde7bf61b838770c658a380e4b1cfc4bd395dbed9ec6c1d977d9d",
  },
  dsaKeyGen: {
    url: `${BASE}/ML-DSA-keyGen-FIPS204/internalProjection.json`,
    sha256: "6027a0ad263de2fa4a96a6bc086b17daa494dcadeb4a51e31b1258225c1d382f",
  },
  dsaSigGen: {
    url: `${BASE}/ML-DSA-sigGen-FIPS204/internalProjection.json`,
    sha256: "9217e65242588b63fb8169cd64d1d92f6611cf41380802d7e043fffc07b0562a",
  },
  dsaSigVer: {
    url: `${BASE}/ML-DSA-sigVer-FIPS204/internalProjection.json`,
    sha256: "85827fd9f058d617b956301d342f2792d66ff188987ccce87f014f0bdb282457",
  },
});
const FIXTURE_SHA256 = Object.freeze({
  kem512: "85d905c671308adc296dc97ef19181e7764e922a2d6efcffb63f47f4df3c801f",
  kem1024: "3f3608771a7ebe89f672ffe7d2818759757f3ed9d4f8d9c073ca6bbaf3fedeea",
  dsa: "c05e4d1b4cc25852882560e7a1f0f5006ffa3869700e150a5e2aa6da8a665787",
});
const encoder = new TextEncoder();

type JsonRecord = Record<string, unknown>;

function lowerHex(value: Uint8Array): string {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function verifyCanonicalFixtureDigest(
  value: unknown,
  expected: string,
  label: string,
): void {
  const canonicalBytes = encoder.encode(`${JSON.stringify(value, null, 2)}\n`);
  if (lowerHex(sha256(canonicalBytes)) !== expected) {
    throw new Error(`Invalid NIST fixture canonical SHA-256: ${label}`);
  }
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid NIST fixture record: ${label}`);
  }
  return value as JsonRecord;
}

function exact(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) throw new Error(`Invalid NIST fixture ${label}`);
}

function hex(value: unknown, bytes: number, label: string): void {
  if (
    typeof value !== "string" ||
    value.length !== bytes * 2 ||
    !/^[0-9A-F]+$/u.test(value)
  ) {
    throw new Error(`Invalid NIST fixture hex: ${label}`);
  }
}

function variableHex(
  value: unknown,
  label: string,
  options: { nonempty?: boolean; maximumBytes?: number } = {},
): void {
  if (
    typeof value !== "string" ||
    value.length % 2 !== 0 ||
    !/^[0-9A-F]*$/u.test(value) ||
    (options.nonempty === true && value.length === 0) ||
    (options.maximumBytes !== undefined &&
      value.length > options.maximumBytes * 2)
  ) {
    throw new Error(`Invalid NIST fixture hex: ${label}`);
  }
}

function source(
  value: unknown,
  expected: { url: string; sha256: string },
  label: string,
): void {
  const item = record(value, label);
  exact(item.url, expected.url, `${label}.url`);
  exact(item.sha256, expected.sha256, `${label}.sha256`);
}

function common(fixture: JsonRecord, parameterSet: string): JsonRecord {
  exact(fixture.schemaVersion, 1, `${parameterSet}.schemaVersion`);
  exact(
    fixture.authority,
    "NIST Cryptographic Algorithm Validation Program (ACVP)",
    `${parameterSet}.authority`,
  );
  exact(fixture.sourceCommit, SOURCE_COMMIT, `${parameterSet}.sourceCommit`);
  exact(fixture.parameterSet, parameterSet, `${parameterSet}.parameterSet`);
  return record(fixture.sources, `${parameterSet}.sources`);
}

function verifyKem(
  value: unknown,
  expected: {
    parameterSet: string;
    publicKeyBytes: number;
    secretKeyBytes: number;
    ciphertextBytes: number;
    keyCase: readonly [number, number];
    encapsulationCase: readonly [number, number];
    decapsulationCase: readonly [number, number];
  },
): void {
  const fixture = record(value, expected.parameterSet);
  const sources = common(fixture, expected.parameterSet);
  source(sources.keyGen, SOURCES.kemKeyGen, `${expected.parameterSet}.keyGen`);
  source(
    sources.encapDecap,
    SOURCES.kemEncapDecap,
    `${expected.parameterSet}.encapDecap`,
  );
  const key = record(fixture.keyGen, `${expected.parameterSet}.keyGenCase`);
  exact(key.tgId, expected.keyCase[0], `${expected.parameterSet}.keyGen.tgId`);
  exact(key.tcId, expected.keyCase[1], `${expected.parameterSet}.keyGen.tcId`);
  hex(key.d, 32, `${expected.parameterSet}.d`);
  hex(key.z, 32, `${expected.parameterSet}.z`);
  hex(key.ek, expected.publicKeyBytes, `${expected.parameterSet}.ek`);
  hex(key.dk, expected.secretKeyBytes, `${expected.parameterSet}.dk`);
  const encapsulation = record(
    fixture.encapsulation,
    `${expected.parameterSet}.encapsulation`,
  );
  exact(
    encapsulation.tgId,
    expected.encapsulationCase[0],
    `${expected.parameterSet}.encapsulation.tgId`,
  );
  exact(
    encapsulation.tcId,
    expected.encapsulationCase[1],
    `${expected.parameterSet}.encapsulation.tcId`,
  );
  hex(
    encapsulation.ek,
    expected.publicKeyBytes,
    `${expected.parameterSet}.encapsulation.ek`,
  );
  hex(encapsulation.m, 32, `${expected.parameterSet}.m`);
  hex(
    encapsulation.c,
    expected.ciphertextBytes,
    `${expected.parameterSet}.encapsulation.c`,
  );
  hex(encapsulation.k, 32, `${expected.parameterSet}.encapsulation.k`);
  const decapsulation = record(
    fixture.decapsulation,
    `${expected.parameterSet}.decapsulation`,
  );
  exact(
    decapsulation.tgId,
    expected.decapsulationCase[0],
    `${expected.parameterSet}.decapsulation.tgId`,
  );
  exact(
    decapsulation.tcId,
    expected.decapsulationCase[1],
    `${expected.parameterSet}.decapsulation.tcId`,
  );
  hex(
    decapsulation.dk,
    expected.secretKeyBytes,
    `${expected.parameterSet}.decapsulation.dk`,
  );
  hex(
    decapsulation.c,
    expected.ciphertextBytes,
    `${expected.parameterSet}.decapsulation.c`,
  );
  hex(decapsulation.k, 32, `${expected.parameterSet}.decapsulation.k`);
}

function verifyDsa(value: unknown): void {
  const fixture = record(value, "ML-DSA-87");
  const sources = common(fixture, "ML-DSA-87");
  source(sources.keyGen, SOURCES.dsaKeyGen, "ML-DSA-87.keyGen");
  source(
    sources.signatureGeneration,
    SOURCES.dsaSigGen,
    "ML-DSA-87.signatureGeneration",
  );
  source(
    sources.signatureVerification,
    SOURCES.dsaSigVer,
    "ML-DSA-87.signatureVerification",
  );
  const key = record(fixture.keyGen, "ML-DSA-87.keyGenCase");
  exact(key.tgId, 3, "ML-DSA-87.keyGen.tgId");
  exact(key.tcId, 51, "ML-DSA-87.keyGen.tcId");
  hex(key.seed, 32, "ML-DSA-87.seed");
  hex(key.pk, 2592, "ML-DSA-87.pk");
  hex(key.sk, 4896, "ML-DSA-87.sk");
  const generation = record(
    fixture.signatureGeneration,
    "ML-DSA-87.signatureGenerationCase",
  );
  exact(generation.tgId, 17, "ML-DSA-87.signatureGeneration.tgId");
  exact(generation.tcId, 242, "ML-DSA-87.signatureGeneration.tcId");
  variableHex(generation.message, "ML-DSA-87.signatureGeneration.message");
  hex(generation.rnd, 32, "ML-DSA-87.rnd");
  hex(generation.pk, 2592, "ML-DSA-87.signatureGeneration.pk");
  hex(generation.sk, 4896, "ML-DSA-87.signatureGeneration.sk");
  variableHex(generation.context, "ML-DSA-87.signatureGeneration.context", {
    nonempty: true,
    maximumBytes: 255,
  });
  hex(generation.signature, 4627, "ML-DSA-87.signatureGeneration.signature");
  const verification = record(
    fixture.signatureVerification,
    "ML-DSA-87.signatureVerificationCase",
  );
  exact(verification.tgId, 5, "ML-DSA-87.signatureVerification.tgId");
  exact(verification.tcId, 63, "ML-DSA-87.signatureVerification.tcId");
  exact(verification.testPassed, true, "ML-DSA-87.testPassed");
  variableHex(verification.message, "ML-DSA-87.signatureVerification.message");
  hex(verification.pk, 2592, "ML-DSA-87.signatureVerification.pk");
  variableHex(verification.context, "ML-DSA-87.signatureVerification.context", {
    nonempty: true,
    maximumBytes: 255,
  });
  hex(
    verification.signature,
    4627,
    "ML-DSA-87.signatureVerification.signature",
  );
}

export function verifyNistFixtureIntegrity(input: {
  kem512: unknown;
  kem1024: unknown;
  dsa: unknown;
}): void {
  verifyCanonicalFixtureDigest(
    input.kem512,
    FIXTURE_SHA256.kem512,
    "ML-KEM-512",
  );
  verifyCanonicalFixtureDigest(
    input.kem1024,
    FIXTURE_SHA256.kem1024,
    "ML-KEM-1024",
  );
  verifyCanonicalFixtureDigest(input.dsa, FIXTURE_SHA256.dsa, "ML-DSA-87");
  verifyKem(input.kem512, {
    parameterSet: "ML-KEM-512",
    publicKeyBytes: 800,
    secretKeyBytes: 1632,
    ciphertextBytes: 768,
    keyCase: [1, 1],
    encapsulationCase: [1, 1],
    decapsulationCase: [4, 76],
  });
  verifyKem(input.kem1024, {
    parameterSet: "ML-KEM-1024",
    publicKeyBytes: 1568,
    secretKeyBytes: 3168,
    ciphertextBytes: 1568,
    keyCase: [3, 51],
    encapsulationCase: [3, 51],
    decapsulationCase: [6, 96],
  });
  verifyDsa(input.dsa);
}
