// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  parseReleaseSignerPolicy,
  validateReleaseSignerPolicy,
} from "../../../scripts/release-signer-policy";

const signer =
  '136596632+levi-cm@users.noreply.github.com namespaces="git" ssh-ed25519 AAAATEST';
const failure =
  "allowed signers must contain exactly one namespace-git release signer";

describe("release signer policy", () => {
  it("accepts the sole Git signer", () => {
    expect(
      parseReleaseSignerPolicy(`# release signer\n${signer}\n`).principal,
    ).toBe("136596632+levi-cm@users.noreply.github.com");
  });

  it.each([
    ["", "missing"],
    [`${signer}\n${signer}\n`, "duplicate"],
    ['*@example.com namespaces="git" ssh-ed25519 AAAATEST\n', "wildcard"],
    [
      'reviewer@example.com namespaces="chat-nocontrol-security-review-cat5-v2" ssh-ed25519 AAAATEST\n',
      "review namespace",
    ],
    [
      'tester@example.com namespaces="chat-nocontrol-physical-device-cat5-v2" ssh-ed25519 AAAATEST\n',
      "tester namespace",
    ],
    ["release@example.com ssh-ed25519 AAAATEST\n", "unrestricted"],
  ])("rejects %s policy", (contents) => {
    expect(validateReleaseSignerPolicy(contents)).toEqual([failure]);
  });
});
