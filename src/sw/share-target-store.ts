import { zeroize } from "../crypto/zeroize";
import {
  MAX_SHARED_TEXT_FILE_BYTES,
  SHARED_ARTIFACT_TTL_MS,
  type SharedArtifactMessage,
  validateSharedTextArtifact,
} from "../share/shared-artifact-contract";

export { MAX_SHARED_TEXT_FILE_BYTES, SHARED_ARTIFACT_TTL_MS };

interface PendingSharedArtifact {
  token: string;
  clientId: string;
  name: string;
  mediaType: "text/plain";
  bytes: Uint8Array;
  expiresAt: number;
}

export class InMemoryShareTargetStore {
  readonly #entries = new Map<string, PendingSharedArtifact>();

  constructor(private readonly ttlMs: number = SHARED_ARTIFACT_TTL_MS) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
      throw new Error("invalid-shared-artifact-ttl");
    }
  }

  get size(): number {
    return this.#entries.size;
  }

  put(
    input: {
      token: string;
      clientId: string;
      name: string;
      mediaType: string;
      bytes: Uint8Array;
    },
    now: number,
  ): void {
    try {
      if (!Number.isSafeInteger(now) || now < 0) {
        throw new Error("invalid-shared-artifact");
      }
      validateSharedTextArtifact(input);
      if (this.#entries.has(input.token)) {
        throw new Error("invalid-shared-artifact");
      }
      this.#entries.set(input.token, {
        token: input.token,
        clientId: input.clientId,
        name: input.name,
        mediaType: "text/plain",
        bytes: Uint8Array.from(input.bytes),
        expiresAt: now + this.ttlMs,
      });
    } finally {
      zeroize(input.bytes);
    }
  }

  messagesForClient(clientId: string, now: number): SharedArtifactMessage[] {
    this.expire(now);
    const messages: SharedArtifactMessage[] = [];
    for (const entry of this.#entries.values()) {
      if (entry.clientId !== clientId) continue;
      messages.push({
        type: "ppx-shared-artifact",
        token: entry.token,
        name: entry.name,
        mediaType: entry.mediaType,
        bytes: Uint8Array.from(entry.bytes),
      });
    }
    return messages;
  }

  acknowledge(token: string, clientId: string): boolean {
    const entry = this.#entries.get(token);
    if (!entry || entry.clientId !== clientId) return false;
    zeroize(entry.bytes);
    this.#entries.delete(token);
    return true;
  }

  expire(now: number): number {
    let expired = 0;
    for (const [token, entry] of this.#entries) {
      if (entry.expiresAt > now) continue;
      zeroize(entry.bytes);
      this.#entries.delete(token);
      expired += 1;
    }
    return expired;
  }

  clear(): void {
    for (const entry of this.#entries.values()) zeroize(entry.bytes);
    this.#entries.clear();
  }
}
