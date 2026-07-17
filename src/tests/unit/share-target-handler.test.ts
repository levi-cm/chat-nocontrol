// @vitest-environment node

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { handleIncomingShareTarget } from "../../sw/share-target-handler";
import {
  InMemoryShareTargetStore,
  MAX_SHARED_TEXT_FILE_BYTES,
} from "../../sw/share-target-store";

function requestWith(file: File, field = "message"): Request {
  const form = new FormData();
  form.append(field, file);
  return new Request("https://app.example/share-target", {
    method: "POST",
    body: form,
  });
}

describe("PWA share-target request handler", () => {
  it("retains one bounded text file without putting a token in the URL", async () => {
    const store = new InMemoryShareTargetStore();
    const response = await handleIncomingShareTarget(
      requestWith(
        new File(["PPX2:MESSAGE:ciphertext"], "discord-message.txt", {
          type: "text/plain",
        }),
      ),
      {
        clientId: "resulting-client",
        scope: "https://app.example/",
        token: "one-time-token",
        now: 100,
        store,
      },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://app.example/#/decrypt",
    );
    expect(response.headers.get("location")).not.toContain("one-time-token");
    expect(store.size).toBe(1);
    expect(store.messagesForClient("resulting-client", 101)).toHaveLength(1);
  });

  it("rejects missing client binding, wrong fields/types and oversized files", async () => {
    const text = new File(["ciphertext"], "message.txt", {
      type: "text/plain",
    });
    const cases: Array<[Request, string]> = [
      [requestWith(text), ""],
      [requestWith(text, "unexpected"), "client"],
      [
        requestWith(
          new File(["ciphertext"], "message.txt", {
            type: "application/octet-stream",
          }),
        ),
        "client",
      ],
      [
        requestWith(
          new File(
            [new Uint8Array(MAX_SHARED_TEXT_FILE_BYTES + 1)],
            "message.txt",
            { type: "text/plain" },
          ),
        ),
        "client",
      ],
    ];
    for (const [request, clientId] of cases) {
      const store = new InMemoryShareTargetStore();
      await expect(
        handleIncomingShareTarget(request, {
          clientId,
          scope: "https://app.example/",
          token: "token",
          now: 100,
          store,
        }),
      ).rejects.toThrow("invalid-shared-artifact");
      expect(store.size).toBe(0);
    }
  });

  it("keeps shared ciphertext out of persistent worker APIs and diagnostics", async () => {
    const source = await readFile(
      new URL("../../sw.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /\b(?:indexedDB|localStorage|sessionStorage)\b/u,
    );
    expect(source).not.toMatch(/\bcaches\.(?:open|put|match)\b/u);
    expect(source).not.toMatch(/\bconsole\.(?:log|debug|info|warn|error)\b/u);
    expect(source).not.toMatch(/searchParams\.(?:set|append)\([^)]*token/iu);
  });
});
