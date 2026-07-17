import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const sourceCommit = "15c0f3deeefbfa8cb6cd32a99e1ca3b738c66bf0";
const base = `https://raw.githubusercontent.com/usnistgov/ACVP-Server/${sourceCommit}/gen-val/json-files`;
const urls = {
  kemKeyGen: `${base}/ML-KEM-keyGen-FIPS203/internalProjection.json`,
  kemEncapDecap: `${base}/ML-KEM-encapDecap-FIPS203/internalProjection.json`,
  dsaKeyGen: `${base}/ML-DSA-keyGen-FIPS204/internalProjection.json`,
  dsaSigGen: `${base}/ML-DSA-sigGen-FIPS204/internalProjection.json`,
  dsaSigVer: `${base}/ML-DSA-sigVer-FIPS204/internalProjection.json`,
};

interface AcvpTestGroup {
  tgId: number;
  parameterSet: string;
  function?: "encapsulation" | "decapsulation";
  deterministic?: boolean;
  signatureInterface?: string;
  preHash?: string;
  externalMu?: boolean;
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
  if (!response.ok) {
    throw new Error(`NIST ACVP fetch failed: ${response.status} ${url}`);
  }
  const raw = await response.text();
  return { raw, json: JSON.parse(raw) as AcvpProjection };
}

function firstTest(
  projection: AcvpProjection,
  predicate: (group: AcvpTestGroup) => boolean,
  description: string,
  testPredicate: (
    test: Record<string, string | number | boolean>,
  ) => boolean = () => true,
): { group: AcvpTestGroup; test: Record<string, string | number | boolean> } {
  const group = projection.testGroups.find(predicate);
  const test = group?.tests.find(testPredicate);
  if (!group || !test) {
    throw new Error(`Pinned NIST ACVP projection lacks ${description}`);
  }
  return { group, test };
}

const sha256 = (raw: string) => createHash("sha256").update(raw).digest("hex");
const fixtureUrl = (name: string) =>
  new URL(`../fixtures/crypto/${name}`, import.meta.url);
const jsonText = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const mode = process.argv.includes("--write")
  ? "write"
  : process.argv.includes("--verify")
    ? "verify"
    : undefined;
if (!mode) {
  throw new Error(
    "Use --write to refresh or --verify to check pinned fixtures",
  );
}

const [kemKeyGen, kemEncapDecap, dsaKeyGen, dsaSigGen, dsaSigVer] =
  await Promise.all([
    load(urls.kemKeyGen),
    load(urls.kemEncapDecap),
    load(urls.dsaKeyGen),
    load(urls.dsaSigGen),
    load(urls.dsaSigVer),
  ]);

function kemFixture(parameterSet: "ML-KEM-512" | "ML-KEM-1024") {
  const key = firstTest(
    kemKeyGen.json,
    (group) => group.parameterSet === parameterSet,
    `${parameterSet} key generation`,
  );
  const encapsulation = firstTest(
    kemEncapDecap.json,
    (group) =>
      group.parameterSet === parameterSet && group.function === "encapsulation",
    `${parameterSet} encapsulation`,
  );
  const decapsulation = firstTest(
    kemEncapDecap.json,
    (group) =>
      group.parameterSet === parameterSet && group.function === "decapsulation",
    `${parameterSet} decapsulation`,
  );
  return {
    schemaVersion: 1,
    authority: "NIST Cryptographic Algorithm Validation Program (ACVP)",
    sourceCommit,
    parameterSet,
    sources: {
      keyGen: { url: urls.kemKeyGen, sha256: sha256(kemKeyGen.raw) },
      encapDecap: {
        url: urls.kemEncapDecap,
        sha256: sha256(kemEncapDecap.raw),
      },
    },
    keyGen: {
      vsId: kemKeyGen.json.vsId,
      tgId: key.group.tgId,
      tcId: key.test.tcId,
      d: key.test.d,
      z: key.test.z,
      ek: key.test.ek,
      dk: key.test.dk,
    },
    encapsulation: {
      vsId: kemEncapDecap.json.vsId,
      tgId: encapsulation.group.tgId,
      tcId: encapsulation.test.tcId,
      ek: encapsulation.test.ek,
      m: encapsulation.test.m,
      c: encapsulation.test.c,
      k: encapsulation.test.k,
    },
    decapsulation: {
      vsId: kemEncapDecap.json.vsId,
      tgId: decapsulation.group.tgId,
      tcId: decapsulation.test.tcId,
      dk: decapsulation.test.dk,
      c: decapsulation.test.c,
      k: decapsulation.test.k,
    },
  };
}

const dsaKey = firstTest(
  dsaKeyGen.json,
  (group) => group.parameterSet === "ML-DSA-87",
  "ML-DSA-87 key generation",
);
const dsaSign = firstTest(
  dsaSigGen.json,
  (group) =>
    group.parameterSet === "ML-DSA-87" &&
    group.deterministic === false &&
    group.signatureInterface === "external" &&
    group.preHash === "pure" &&
    group.externalMu === false,
  "randomized pure ML-DSA-87 signature generation",
  (test) => typeof test.context === "string" && test.context.length > 0,
);
const dsaVerify = firstTest(
  dsaSigVer.json,
  (group) =>
    group.parameterSet === "ML-DSA-87" &&
    group.signatureInterface === "external" &&
    group.preHash === "pure" &&
    group.externalMu === false,
  "pure ML-DSA-87 signature verification",
  (test) =>
    test.testPassed === true &&
    typeof test.context === "string" &&
    test.context.length > 0,
);
const dsaFixture = {
  schemaVersion: 1,
  authority: "NIST Cryptographic Algorithm Validation Program (ACVP)",
  sourceCommit,
  parameterSet: "ML-DSA-87",
  sources: {
    keyGen: { url: urls.dsaKeyGen, sha256: sha256(dsaKeyGen.raw) },
    signatureGeneration: {
      url: urls.dsaSigGen,
      sha256: sha256(dsaSigGen.raw),
    },
    signatureVerification: {
      url: urls.dsaSigVer,
      sha256: sha256(dsaSigVer.raw),
    },
  },
  keyGen: {
    vsId: dsaKeyGen.json.vsId,
    tgId: dsaKey.group.tgId,
    tcId: dsaKey.test.tcId,
    seed: dsaKey.test.seed,
    pk: dsaKey.test.pk,
    sk: dsaKey.test.sk,
  },
  signatureGeneration: {
    vsId: dsaSigGen.json.vsId,
    tgId: dsaSign.group.tgId,
    tcId: dsaSign.test.tcId,
    message: dsaSign.test.message,
    rnd: dsaSign.test.rnd,
    pk: dsaSign.test.pk,
    sk: dsaSign.test.sk,
    context: dsaSign.test.context,
    signature: dsaSign.test.signature,
  },
  signatureVerification: {
    vsId: dsaSigVer.json.vsId,
    tgId: dsaVerify.group.tgId,
    tcId: dsaVerify.test.tcId,
    testPassed: dsaVerify.test.testPassed,
    message: dsaVerify.test.message,
    pk: dsaVerify.test.pk,
    context: dsaVerify.test.context,
    signature: dsaVerify.test.signature,
  },
};

const fixtures = [
  ["nist-acvp-ml-kem-512.json", kemFixture("ML-KEM-512")],
  ["nist-acvp-ml-kem-1024.json", kemFixture("ML-KEM-1024")],
  ["nist-acvp-ml-dsa-87.json", dsaFixture],
] as const;

for (const [name, fixture] of fixtures) {
  const path = fixtureUrl(name);
  const expected = jsonText(fixture);
  if (mode === "write") {
    writeFileSync(path, expected);
    console.log(`Wrote pinned NIST ACVP fixture: ${path.pathname}`);
  } else if (readFileSync(path, "utf8") !== expected) {
    throw new Error(`Pinned NIST ACVP fixture is stale: ${path.pathname}`);
  } else {
    console.log(`Verified pinned NIST ACVP fixture: ${path.pathname}`);
  }
}
