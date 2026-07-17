import type {
  DecryptedFileOutputV2,
  DecryptedTextOutputV2,
  DecryptTextInputV2,
  DerivedIdentityV2,
  EncryptedTextObjectV2,
  EncryptFileInputV2,
  EncryptTextInputV2,
  LockedVaultObjectV2,
} from "../protocol/types-v2";
import type { PPXCryptoError, PPXParseError } from "../protocol/types";
import type {
  DecryptFileSourceInputV2,
  EncryptedFileBlobOutputV2,
} from "./file-v2";
import type { LockVaultInputV2, UnlockVaultInputV2 } from "./vault-v2";

export type PPXCryptoWorkerRequest =
  | { kind: "encrypt-text"; requestId: string; input: EncryptTextInputV2 }
  | { kind: "decrypt-text"; requestId: string; input: DecryptTextInputV2 }
  | { kind: "unlock-vault"; requestId: string; input: UnlockVaultInputV2 }
  | { kind: "lock-vault"; requestId: string; input: LockVaultInputV2 }
  | { kind: "cancel"; requestId: string };

export type PPXFileWorkerRequest =
  | { kind: "encrypt-file"; requestId: string; input: EncryptFileInputV2 }
  | { kind: "decrypt-file"; requestId: string; input: DecryptFileSourceInputV2 }
  | { kind: "cancel"; requestId: string };

export type PPXWorkerRequest = PPXCryptoWorkerRequest | PPXFileWorkerRequest;

export type PPXWorkerEvent =
  | {
      kind: "progress";
      requestId: string;
      stage: "parse" | "derive" | "encrypt" | "decrypt" | "sign" | "serialize";
      completedBytes: bigint;
      totalBytes: bigint;
      chunkIndex?: number;
    }
  | {
      kind: "completed";
      requestId: string;
      result:
        | EncryptedTextObjectV2
        | DecryptedTextOutputV2
        | EncryptedFileBlobOutputV2
        | DecryptedFileOutputV2
        | LockedVaultObjectV2
        | DerivedIdentityV2;
    }
  | { kind: "error"; requestId: string; code: PPXSafeWorkerError }
  | { kind: "cancelled"; requestId: string };

export type PPXSafeWorkerError = PPXParseError | PPXCryptoError;
