import type {
  DecryptedQrTextOutput,
  DecryptedFileOutput,
  DecryptedTextOutput,
  DecryptFileInput,
  DecryptTextInput,
  DecryptQrTextInput,
  DerivedIdentity,
  EncryptedFileBlobOutput,
  EncryptedFileObject,
  EncryptedTextObject,
  EncryptedQrTextObject,
  EncryptFileInput,
  EncryptTextInput,
  EncryptQrTextInput,
  LockedVaultObject,
  LockVaultInput,
  PPXCryptoError,
  PPXParseError,
  UnlockVaultInput,
} from "../protocol/types";

export type PPXWorkerRequest =
  | { kind: "encrypt-text"; requestId: string; input: EncryptTextInput }
  | { kind: "decrypt-text"; requestId: string; input: DecryptTextInput }
  | { kind: "encrypt-qr-text"; requestId: string; input: EncryptQrTextInput }
  | { kind: "decrypt-qr-text"; requestId: string; input: DecryptQrTextInput }
  | { kind: "encrypt-file"; requestId: string; input: EncryptFileInput }
  | { kind: "decrypt-file"; requestId: string; input: DecryptFileInput }
  | { kind: "unlock-vault"; requestId: string; input: UnlockVaultInput }
  | { kind: "lock-vault"; requestId: string; input: LockVaultInput }
  | { kind: "cancel"; requestId: string };

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
        | EncryptedTextObject
        | EncryptedQrTextObject
        | EncryptedFileObject
        | EncryptedFileBlobOutput
        | LockedVaultObject
        | DerivedIdentity;
    }
  | {
      kind: "completed";
      requestId: string;
      result: DecryptedTextOutput | DecryptedQrTextOutput | DecryptedFileOutput;
    }
  | { kind: "error"; requestId: string; code: PPXSafeWorkerError }
  | { kind: "cancelled"; requestId: string };

export type PPXSafeWorkerError = PPXParseError | PPXCryptoError;
