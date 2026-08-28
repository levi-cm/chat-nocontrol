import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TestTlsCredentials {
  key: Buffer;
  cert: Buffer;
}

let cachedCredentials: TestTlsCredentials | undefined;

export function testTlsCredentials(): TestTlsCredentials {
  if (cachedCredentials) return cachedCredentials;
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "cat5-test-tls-"));
  const keyPath = join(temporaryDirectory, "key.pem");
  const certificatePath = join(temporaryDirectory, "certificate.pem");
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-sha256",
        "-nodes",
        "-keyout",
        keyPath,
        "-out",
        certificatePath,
        "-days",
        "1",
        "-subj",
        "/CN=127.0.0.1",
        "-addext",
        "subjectAltName=IP:127.0.0.1,DNS:localhost",
      ],
      { stdio: "ignore" },
    );
    cachedCredentials = {
      key: readFileSync(keyPath),
      cert: readFileSync(certificatePath),
    };
    return cachedCredentials;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}
