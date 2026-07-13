import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const sourceCommit = "15c0f3deeefbfa8cb6cd32a99e1ca3b738c66bf0";
const base = `https://raw.githubusercontent.com/usnistgov/ACVP-Server/${sourceCommit}/gen-val/json-files`;
const keyGenUrl = `${base}/ML-KEM-keyGen-FIPS203/internalProjection.json`;
const encapDecapUrl = `${base}/ML-KEM-encapDecap-FIPS203/internalProjection.json`;
const fixturePath = new URL(
  "../fixtures/crypto/nist-acvp-ml-kem-512.json",
  import.meta.url,
);

interface AcvpTestGroup {
  tgId: number;
  parameterSet: string;
  function?: "encapsulation" | "decapsulation";
  tests: Array<Record<string, string | number | boolean>>;
}

interface AcvpProjection {
  vsId: number;
  algorithm: string;
  mode: string;
  revision: string;
  testGroups: AcvpTestGroup[];
}

async function load(
  url: string,
): Promise<{ raw: string; json: AcvpProjection }> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`NIST ACVP fetch failed: ${response.status}`);
  const raw = await response.text();
  return { raw, json: JSON.parse(raw) as AcvpProjection };
}

if (!process.argv.includes("--write")) {
  throw new Error("Use --write to explicitly refresh the pinned NIST fixture");
}

const [keyGen, encapDecap] = await Promise.all([
  load(keyGenUrl),
  load(encapDecapUrl),
]);
const keyGroup = keyGen.json.testGroups.find(
  (group) => group.parameterSet === "ML-KEM-512",
);
const encapsulationGroup = encapDecap.json.testGroups.find(
  (group) =>
    group.parameterSet === "ML-KEM-512" && group.function === "encapsulation",
);
const decapsulationGroup = encapDecap.json.testGroups.find(
  (group) =>
    group.parameterSet === "ML-KEM-512" && group.function === "decapsulation",
);
const keyTest = keyGroup?.tests[0];
const encapsulationTest = encapsulationGroup?.tests[0];
const decapsulationTest = decapsulationGroup?.tests[0];
if (
  !keyGroup ||
  !encapsulationGroup ||
  !decapsulationGroup ||
  !keyTest ||
  !encapsulationTest ||
  !decapsulationTest
) {
  throw new Error("Pinned NIST ACVP projection lacks ML-KEM-512 test cases");
}
const sha256 = (raw: string) => createHash("sha256").update(raw).digest("hex");
const output = {
  schemaVersion: 1,
  authority: "NIST Cryptographic Algorithm Validation Program (ACVP)",
  sourceCommit,
  sources: {
    keyGen: { url: keyGenUrl, sha256: sha256(keyGen.raw) },
    encapDecap: { url: encapDecapUrl, sha256: sha256(encapDecap.raw) },
  },
  keyGen: {
    vsId: keyGen.json.vsId,
    tgId: keyGroup.tgId,
    tcId: keyTest.tcId,
    d: keyTest.d,
    z: keyTest.z,
    ek: keyTest.ek,
    dk: keyTest.dk,
  },
  encapsulation: {
    vsId: encapDecap.json.vsId,
    tgId: encapsulationGroup.tgId,
    tcId: encapsulationTest.tcId,
    ek: encapsulationTest.ek,
    m: encapsulationTest.m,
    c: encapsulationTest.c,
    k: encapsulationTest.k,
  },
  decapsulation: {
    vsId: encapDecap.json.vsId,
    tgId: decapsulationGroup.tgId,
    tcId: decapsulationTest.tcId,
    dk: decapsulationTest.dk,
    c: decapsulationTest.c,
    k: decapsulationTest.k,
  },
};
writeFileSync(fixturePath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote pinned NIST ACVP fixture: ${fixturePath.pathname}`);
