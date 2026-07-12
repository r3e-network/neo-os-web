import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("Neo Swap quotes use the Morpheus DataFeed instead of a missing wallet SDK helper", () => {
  const hook = read("apps/neo-swap/src/hooks/useSwapEngine.ts");
  const playArea = read("apps/neo-swap/src/PlayArea.tsx");
  const main = read("apps/neo-swap/src/main.tsx");

  assert.match(hook, /import \{ useMorpheusDataFeed \} from "@shared\/composables\/useMorpheusDataFeed";/);
  assert.match(hook, /const datafeed = useMorpheusDataFeed\(\);/);
  // Both price legs are fetched in parallel from the Morpheus datafeed and then
  // restored to the contract's fixed-six integers before quote math.
  assert.match(hook, /const \[from\w+, to\w+\] = await Promise\.all\(\[/);
  assert.match(hook, /loadVerifiedPriceLeg\(requestedFrom\),/);
  assert.match(hook, /loadVerifiedPriceLeg\(requestedTo\),/);
  assert.match(hook, /morpheusPriceUnits\(fromQuote\.price\)/);
  assert.match(hook, /quoteOutputUnits\(/);
  assert.doesNotMatch(hook, /amount \* rate|fromQuote\.price \/ toQuote\.price/);
  assert.match(hook, /function setFromAmount\(value: string\)/);
  assert.match(hook, /fromAmount\.set\(value\);[\s\S]*onFromAmountChange\(\);/);
  assert.match(playArea, /dispatchSafely\("setFromAmount", value\)/);
  assert.doesNotMatch(playArea, /normalizeAmountForToken|Math\.floor\(Number\(value\)\)/);
  assert.match(main, /ctx\.framework\.actions\.register\("setFromAmount"/);
  assert.doesNotMatch(hook, /waitForSDK/);
});
