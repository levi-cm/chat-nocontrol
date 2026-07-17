import {
  mlDsa87Keygen,
  mlDsa87Sign,
  mlDsa87Verify,
  mlKem1024Decapsulate,
  mlKem1024Encapsulate,
  mlKem1024Keygen,
} from "../src/crypto/pq-provider-v2";

function measure<T>(operation: () => T): { milliseconds: number; value: T } {
  const started = performance.now();
  const value = operation();
  return { milliseconds: performance.now() - started, value };
}

const message = new TextEncoder().encode("PPX-PQ-5 benchmark smoke");
const context = new TextEncoder().encode("PPX/CONTACT/V2");
const kemKeygen = measure(() => mlKem1024Keygen());
const kemEncapsulation = measure(() =>
  mlKem1024Encapsulate(kemKeygen.value.publicKey),
);
const kemDecapsulation = measure(() =>
  mlKem1024Decapsulate(
    kemEncapsulation.value.cipherText,
    kemKeygen.value.secretKey,
  ),
);
const dsaKeygen = measure(() => mlDsa87Keygen());
const dsaSign = measure(() =>
  mlDsa87Sign(
    message,
    dsaKeygen.value.secretKey,
    context,
    crypto.getRandomValues(new Uint8Array(32)),
  ),
);
const dsaVerify = measure(() =>
  mlDsa87Verify(dsaSign.value, message, dsaKeygen.value.publicKey, context),
);

if (!dsaVerify.value) throw new Error("ML-DSA-87 benchmark smoke failed");
if (
  !kemDecapsulation.value.every(
    (byte, index) => byte === kemEncapsulation.value.sharedSecret[index],
  )
) {
  throw new Error("ML-KEM-1024 benchmark smoke failed");
}

console.log(
  JSON.stringify(
    {
      suite: "PPX-PQ-5",
      sizes: {
        kemPublicKey: kemKeygen.value.publicKey.byteLength,
        kemSecretKey: kemKeygen.value.secretKey.byteLength,
        kemCiphertext: kemEncapsulation.value.cipherText.byteLength,
        dsaPublicKey: dsaKeygen.value.publicKey.byteLength,
        dsaSecretKey: dsaKeygen.value.secretKey.byteLength,
        dsaSignature: dsaSign.value.byteLength,
      },
      milliseconds: {
        kemKeygen: kemKeygen.milliseconds,
        kemEncapsulation: kemEncapsulation.milliseconds,
        kemDecapsulation: kemDecapsulation.milliseconds,
        dsaKeygen: dsaKeygen.milliseconds,
        dsaSign: dsaSign.milliseconds,
        dsaVerify: dsaVerify.milliseconds,
      },
    },
    null,
    2,
  ),
);
