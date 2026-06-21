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
  // Both price legs are fetched in parallel from the Morpheus datafeed. The hook
  // now binds quote objects (getPriceWithMeta returns price + freshness metadata)
  // rather than bare numbers; getPrice is the metadata-less shorthand. Accept
  // either binding/accessor so a future revert to a wallet-SDK helper still fails.
  assert.match(hook, /const \[from\w+, to\w+\] = await Promise\.all\(\[/);
  assert.match(hook, /datafeed\.getPrice(?:WithMeta)?\(fromToken\.get\(\)\.symbol\),/);
  assert.match(hook, /datafeed\.getPrice(?:WithMeta)?\(toToken\.get\(\)\.symbol\),/);
  assert.match(hook, /const rate = from\w+(?:\.price)? \/ to\w+(?:\.price)?;/);
  assert.match(hook, /function setFromAmount\(value: string\)/);
  assert.match(hook, /fromAmount\.set\(value\);[\s\S]*onFromAmountChange\(\);/);
  assert.match(playArea, /dispatch\("setFromAmount", value\)/);
  assert.match(main, /ctx\.registerAction\("setFromAmount"/);
  assert.doesNotMatch(hook, /waitForSDK/);
});
