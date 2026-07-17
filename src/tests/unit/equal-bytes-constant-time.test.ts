import { describe, expect, it } from "vitest";
import checksumSource from "../../protocol/checksum.ts?raw";

describe("equalBytes constant-time shape", () => {
  it("has no data-dependent return inside its byte loop", () => {
    const body = checksumSource.match(
      /export function equalBytes[\s\S]*?for \([\s\S]*?\) \{([\s\S]*?)\n  \}/u,
    )?.[1];

    expect(body).toBeDefined();
    expect(body).not.toMatch(/\breturn\b/u);
    expect(body).toMatch(/difference \|=/u);
    expect(checksumSource).toMatch(/return difference === 0/u);
  });
});
