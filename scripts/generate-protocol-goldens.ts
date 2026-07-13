import { sha512 } from "@noble/hashes/sha2.js";
import { readFileSync, writeFileSync } from "node:fs";

import {
  canonicalProtocolBytes,
  protocolFamilies,
} from "../src/tests/helpers/canonical-protocol";

const fixturePath = new URL(
  "../fixtures/protocol/golden-v1.json",
  import.meta.url,
);
const hex = (value: Uint8Array) =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const bytes = await canonicalProtocolBytes();
const fixtures = Object.fromEntries(
  protocolFamilies.map((family) => [
    family,
    {
      encodedLength: bytes[family].byteLength,
      encodedSha512: hex(sha512(bytes[family])),
      encodedBase64: Buffer.from(bytes[family]).toString("base64"),
    },
  ]),
);
const output = `${JSON.stringify(
  {
    schemaVersion: 1,
    description:
      "Fixed canonical PPXC, PPXV, PPXR, PPXT, and PPXF v1 wire objects.",
    fixtures,
  },
  null,
  2,
)}\n`;

if (process.argv.includes("--write")) {
  writeFileSync(fixturePath, output);
  console.log(`Wrote ${fixturePath.pathname}`);
} else if (process.argv.includes("--verify")) {
  if (readFileSync(fixturePath, "utf8") !== output) {
    throw new Error(
      "Protocol golden fixtures are stale. Run npm run protocol-goldens:write.",
    );
  }
  console.log("All-family PPX protocol goldens verified.");
} else {
  process.stdout.write(output);
}
