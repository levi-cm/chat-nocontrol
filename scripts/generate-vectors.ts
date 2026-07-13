import { readFileSync, writeFileSync } from "node:fs";
import {
  deriveHkdfSha512,
  deriveVaultKey,
  ed25519PublicKey,
  mlKem512Encapsulate,
  mlKem512Keygen,
  sha512Digest,
  signEd25519,
  x25519PublicKey,
} from "../src/crypto/noble-provider";
import { encryptAesGcm } from "../src/crypto/webcrypto";

const fixturePath = new URL(
  "../fixtures/crypto/primitive-vectors.json",
  import.meta.url,
);
const text = new TextEncoder();
const bytes = (hex: string) =>
  Uint8Array.from(hex.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
const hex = (value: Uint8Array) =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function generate() {
  const xSecret = bytes(
    "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a",
  );
  const signingSeed = bytes(
    "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
  );
  const mlKem = mlKem512Keygen(
    Uint8Array.from({ length: 64 }, (_, index) => index),
  );
  const encapsulated = mlKem512Encapsulate(
    mlKem.publicKey,
    Uint8Array.from({ length: 32 }, (_, index) => 255 - index),
  );
  return {
    sha512Abc: hex(sha512Digest(text.encode("abc"))),
    hkdfSha512: hex(
      deriveHkdfSha512(
        text.encode("input key material"),
        text.encode("salt"),
        text.encode("PPX test"),
        32,
      ),
    ),
    scrypt: hex(
      await deriveVaultKey(
        "correct horse battery staple",
        new Uint8Array(16).fill(0x5a),
      ),
    ),
    x25519Public: hex(x25519PublicKey(xSecret)),
    ed25519Public: hex(ed25519PublicKey(signingSeed)),
    ed25519Signature: hex(signEd25519(new Uint8Array(), signingSeed)),
    mlKemPublicSha512: hex(sha512Digest(mlKem.publicKey)),
    mlKemCiphertextSha512: hex(sha512Digest(encapsulated.cipherText)),
    aes256GcmEmpty: hex(
      await encryptAesGcm(
        new Uint8Array(32),
        new Uint8Array(12),
        new Uint8Array(),
      ),
    ),
  };
}

const generated = `${JSON.stringify(await generate(), null, 2)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(fixturePath, generated);
  console.log(`Wrote ${fixturePath.pathname}`);
} else if (process.argv.includes("--verify")) {
  if (readFileSync(fixturePath, "utf8") !== generated) {
    console.error(
      "Primitive vector fixtures are stale. Run npm run vectors:write.",
    );
    process.exit(1);
  }
  console.log("Primitive vector fixtures verified.");
} else {
  process.stdout.write(generated);
}
