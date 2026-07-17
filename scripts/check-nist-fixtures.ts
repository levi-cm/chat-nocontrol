import { readFileSync } from "node:fs";
import { verifyNistFixtureIntegrity } from "./verify-nist-fixtures";

function readJson(path: URL): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

verifyNistFixtureIntegrity({
  kem512: readJson(
    new URL("../fixtures/crypto/nist-acvp-ml-kem-512.json", import.meta.url),
  ),
  kem1024: readJson(
    new URL("../fixtures/crypto/nist-acvp-ml-kem-1024.json", import.meta.url),
  ),
  dsa: readJson(
    new URL("../fixtures/crypto/nist-acvp-ml-dsa-87.json", import.meta.url),
  ),
});
console.log(
  "Pinned NIST ACVP fixture metadata and source hashes verified offline.",
);
