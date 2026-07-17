import { describe, expect, it, vi } from "vitest";
import {
  createIncomingSharedArtifactHandoff,
  type IncomingSharedArtifact,
} from "../../share/incoming-shared-artifact";
import { isSharedArtifactMessage } from "../../share/shared-artifact-contract";
import {
  InMemoryShareTargetStore,
  MAX_SHARED_TEXT_FILE_BYTES,
} from "../../sw/share-target-store";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("memory-only PWA share-target handoff", () => {
  it("delivers only to the matching client and wipes on acknowledgement", () => {
    const store = new InMemoryShareTargetStore(30_000);
    const source = bytes("PPX2:MESSAGE:example");
    store.put(
      {
        token: "token-a",
        clientId: "client-a",
        name: "message.txt",
        mediaType: "text/plain",
        bytes: source,
      },
      1_000,
    );

    expect(source.every((value) => value === 0)).toBe(true);
    expect(store.messagesForClient("client-b", 1_001)).toEqual([]);
    const [message] = store.messagesForClient("client-a", 1_001);
    expect(message?.type).toBe("ppx-shared-artifact");
    expect(new TextDecoder().decode(message?.bytes)).toBe(
      "PPX2:MESSAGE:example",
    );

    expect(store.acknowledge("token-a", "client-b")).toBe(false);
    expect(store.size).toBe(1);
    expect(store.acknowledge("token-a", "client-a")).toBe(true);
    expect(store.size).toBe(0);
    expect(message?.bytes.every((value) => value === 0)).toBe(false);
  });

  it("expires and wipes unacknowledged bytes", () => {
    const store = new InMemoryShareTargetStore(100);
    const wipeSpy = vi.spyOn(Uint8Array.prototype, "fill");
    try {
      store.put(
        {
          token: "token-expire",
          clientId: "client-a",
          name: "message.txt",
          mediaType: "text/plain",
          bytes: bytes("ciphertext"),
        },
        500,
      );
      expect(store.expire(599)).toBe(0);
      expect(store.expire(600)).toBe(1);
      expect(store.size).toBe(0);
      expect(wipeSpy.mock.calls.some((call) => call[0] === 0)).toBe(true);
    } finally {
      wipeSpy.mockRestore();
    }
  });

  it("rejects wrong media, empty, oversized and invalid UTF-8 files", () => {
    const store = new InMemoryShareTargetStore(100);
    const common = {
      token: "token",
      clientId: "client",
      name: "message.txt",
    };
    expect(() =>
      store.put(
        {
          ...common,
          mediaType: "application/octet-stream",
          bytes: bytes("ciphertext"),
        },
        0,
      ),
    ).toThrow("invalid-shared-artifact");
    expect(() =>
      store.put(
        { ...common, mediaType: "text/plain", bytes: new Uint8Array() },
        0,
      ),
    ).toThrow("invalid-shared-artifact");
    expect(() =>
      store.put(
        {
          ...common,
          mediaType: "text/plain",
          bytes: new Uint8Array(MAX_SHARED_TEXT_FILE_BYTES + 1),
        },
        0,
      ),
    ).toThrow("invalid-shared-artifact");
    expect(() =>
      store.put(
        {
          ...common,
          mediaType: "text/plain",
          bytes: Uint8Array.of(0xc3, 0x28),
        },
        0,
      ),
    ).toThrow("invalid-shared-artifact");
    expect(store.size).toBe(0);
  });

  it("page handoff acknowledges only after retaining a validated artifact", () => {
    const posted: unknown[] = [];
    let messageListener: ((event: MessageEvent) => void) | undefined;
    const serviceWorker = {
      controller: { postMessage: (message: unknown) => posted.push(message) },
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (type === "message")
          messageListener = listener as (event: MessageEvent) => void;
      },
      removeEventListener: vi.fn(),
    } as unknown as ServiceWorkerContainer;
    const received: IncomingSharedArtifact[] = [];
    const handoff = createIncomingSharedArtifactHandoff(
      serviceWorker,
      (artifact) => received.push(artifact),
      () => 123,
    );

    expect(posted).toEqual([{ type: "ppx-shared-artifact-ready" }]);
    const payload = bytes("PPX2:MESSAGE:value");
    const event = {
      data: {
        type: "ppx-shared-artifact",
        token: "one-time-token",
        name: "message.txt",
        mediaType: "text/plain",
        bytes: payload,
      },
    } as MessageEvent;
    expect(messageListener).toBeTypeOf("function");
    expect(isSharedArtifactMessage(event.data)).toBe(true);
    messageListener?.(event);

    expect(received).toHaveLength(1);
    expect(received[0]?.receivedAt).toBe(123);
    expect(new TextDecoder().decode(received[0]?.bytes)).toBe(
      "PPX2:MESSAGE:value",
    );
    expect(posted.at(-1)).toEqual({
      type: "ppx-shared-artifact-ack",
      token: "one-time-token",
    });
    handoff.dispose();
  });
});
