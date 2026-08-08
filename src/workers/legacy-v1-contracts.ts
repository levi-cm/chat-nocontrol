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
