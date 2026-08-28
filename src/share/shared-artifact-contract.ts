import { zeroize } from "../crypto/zeroize";

export const MAX_SHARED_TEXT_FILE_BYTES = 406_000;
export const SHARED_ARTIFACT_TTL_MS = 60_000;

export interface IncomingSharedArtifact {
  readonly name: string;
  readonly mediaType: "text/plain";
  readonly bytes: Uint8Array;
  readonly receivedAt: number;
}

export interface SharedArtifactMessage {
  readonly type: "ppx-shared-artifact";
  readonly token: string;
  readonly name: string;
  readonly mediaType: "text/plain";
  readonly bytes: Uint8Array;
}

export interface SharedArtifactReadyMessage {
  readonly type: "ppx-shared-artifact-ready";
}

export interface SharedArtifactAckMessage {
  readonly type: "ppx-shared-artifact-ack";
  readonly token: string;
}

function validName(name: string): boolean {
  return (
    name.length >= 1 &&
    name.length <= 128 &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("\0")
  );
}

export function validateSharedTextArtifact(input: {
  token: string;
  clientId: string;
  name: string;
  mediaType: string;
  bytes: Uint8Array;
}): void {
  if (
    input.token.length < 1 ||
    input.token.length > 128 ||
    input.clientId.length < 1 ||
    input.clientId.length > 256 ||
    !validName(input.name) ||
    input.mediaType !== "text/plain" ||
    input.bytes.byteLength < 1 ||
    input.bytes.byteLength > MAX_SHARED_TEXT_FILE_BYTES
  ) {
    throw new Error("invalid-shared-artifact");
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
  } catch {
    throw new Error("invalid-shared-artifact");
  }
}

export function isSharedArtifactMessage(
  value: unknown,
): value is SharedArtifactMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SharedArtifactMessage>;
  const candidateBytes = candidate.bytes;
  if (
    candidate.type !== "ppx-shared-artifact" ||
    typeof candidate.token !== "string" ||
    typeof candidate.name !== "string" ||
    candidate.mediaType !== "text/plain" ||
    Object.prototype.toString.call(candidateBytes) !== "[object Uint8Array]"
  ) {
    return false;
  }
  const probe = Uint8Array.from(candidateBytes as Uint8Array);
  try {
    validateSharedTextArtifact({
      token: candidate.token,
      clientId: "page",
      name: candidate.name,
      mediaType: candidate.mediaType,
      bytes: probe,
    });
    return true;
  } catch {
    return false;
  } finally {
    zeroize(probe);
  }
}
