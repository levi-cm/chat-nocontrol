import { describe, expect, it } from "vitest";
import { validateDocumentation } from "../../docs/validate";

describe("documentation contract checker", () => {
  it("rejects missing authority, broken links, and broken dependencies", () => {
    const failures = validateDocumentation({
      files: new Map([
        [
          "docs/a.md",
          "See [missing](missing.md) and the dependency `docs/lost.md`.",
        ],
      ]),
      availablePaths: new Set(["docs/a.md"]),
    });
    expect(failures).toEqual([
      "broken documentation dependency: docs/a.md -> docs/lost.md",
      "broken local link: docs/a.md -> docs/missing.md",
      "missing authority marker: docs/a.md",
    ]);
  });

  it("accepts resolved local links and authority metadata", () => {
    expect(
      validateDocumentation({
        files: new Map([
          [
            "docs/a.md",
            "> **Authority:** Test.\n\nSee [B](b.md) and `docs/b.md`.",
          ],
        ]),
        availablePaths: new Set(["docs/a.md", "docs/b.md"]),
      }),
    ).toEqual([]);
  });
});
