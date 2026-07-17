import { readFileSync, writeFileSync } from "node:fs";
import { canonicalCat5Foundation } from "../src/tests/helpers/canonical-cat5";

const fixturePath = new URL(
  "../fixtures/protocol/golden-cat5-foundation.json",
  import.meta.url,
);
const output = `${JSON.stringify(await canonicalCat5Foundation(), null, 2)}\n`;

if (process.argv.includes("--write")) {
  writeFileSync(fixturePath, output);
  console.log(`Wrote ${fixturePath.pathname}`);
} else if (process.argv.includes("--verify")) {
  if (readFileSync(fixturePath, "utf8") !== output) {
    throw new Error(
      "Cat-5 foundation golden is stale. Run npm run cat5-golden:write.",
    );
  }
  console.log("Cat-5 foundation golden verified.");
} else {
  process.stdout.write(output);
}
