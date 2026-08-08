import type {
  DecryptedFileOutput,
  DecryptedQrTextOutput,
  DecryptedTextOutput,
  EncryptedFileObject,
  EncryptedTextObject,
  PPXCryptoError,
  PPXParseError,
} from "../protocol/types";
import type { DerivedIdentityV2 } from "../protocol/types-v2";

export type LegacyV1WorkerRequest =
  | {
      kind: "decrypt-compact-v1";
      requestId: string;
      input: {
        ppxqBytes: Uint8Array;
        senderContactBytes: Uint8Array;
        masterEntropy: Uint8Array;
      };
    }
  | {
      kind: "decrypt-text-v1";
      requestId: string;
      input: { object: EncryptedTextObject; masterEntropy: Uint8Array };
    }
  | {
      kind: "decrypt-file-v1";
      requestId: string;
      input: {
        object: EncryptedFileObject | Blob;
        masterEntropy: Uint8Array;
      };
    }
  | {
      kind: "migrate-recovery-v1";
      requestId: string;
      input: { bytes: Uint8Array };
    }
  | {
      kind: "migrate-vault-v1";
      requestId: string;
      input: { bytes: Uint8Array; passphrase: string };
    }
  | { kind: "cancel"; requestId: string };

export type LegacyV1WorkerEvent =
  | {
      kind: "progress";
      requestId: string;
      stage: "parse" | "decrypt";
      completedBytes: bigint;
      totalBytes: bigint;
      chunkIndex?: number;
    }
  | {
      kind: "completed";
      requestId: string;
      result:
        | DecryptedTextOutput
        | DecryptedQrTextOutput
        | DecryptedFileOutput
        | DerivedIdentityV2;
    }
  | {
      kind: "error";
      requestId: string;
      code: PPXParseError | PPXCryptoError;
    }
  | { kind: "cancelled"; requestId: string };

function transferableBuffers(buffers: readonly Uint8Array[]): ArrayBuffer[] {
  const unique = new Set<ArrayBuffer>();
  for (const bytes of buffers) {
    if (
      Object.prototype.toString.call(bytes.buffer) === "[object ArrayBuffer]"
    ) {
      unique.add(bytes.buffer as ArrayBuffer);
    }
  }
  return [...unique];
}

export function legacyV1RequestTransferList(
  request: LegacyV1WorkerRequest,
): ArrayBuffer[] {
  if (request.kind === "decrypt-compact-v1") {
    return transferableBuffers([
      request.input.ppxqBytes,
      request.input.senderContactBytes,
      request.input.masterEntropy,
    ]);
  }
  if (
    request.kind === "decrypt-text-v1" ||
    request.kind === "decrypt-file-v1"
  ) {
    return transferableBuffers([request.input.masterEntropy]);
  }
  if (
    request.kind === "migrate-recovery-v1" ||
    request.kind === "migrate-vault-v1"
  ) {
    return transferableBuffers([request.input.bytes]);
  }
  return [];
}

function isDerivedIdentityV2(value: unknown): value is DerivedIdentityV2 {
  return (
    typeof value === "object" &&
    value !== null &&
    "masterEntropy" in value &&
    "kemPublicKey" in value &&
    "kemSecretKey" in value &&
    "signingPublicKey" in value &&
    "signingSecretKey" in value &&
    "fingerprint" in value &&
    "identityId" in value
  );
}

export function legacyV1EventTransferList(
  event: LegacyV1WorkerEvent,
): ArrayBuffer[] {
  if (event.kind !== "completed" || !isDerivedIdentityV2(event.result)) {
    return [];
  }
  return transferableBuffers([
    event.result.masterEntropy,
    event.result.kemPublicKey,
    event.result.kemSecretKey,
    event.result.signingPublicKey,
    event.result.signingSecretKey,
    event.result.fingerprint,
    event.result.identityId,
  ]);
}

export function zeroizeLegacyV1TransferList(
  transferList: readonly ArrayBuffer[],
): void {
  for (const buffer of transferList) {
    if (buffer.byteLength > 0) new Uint8Array(buffer).fill(0);
  }
}
