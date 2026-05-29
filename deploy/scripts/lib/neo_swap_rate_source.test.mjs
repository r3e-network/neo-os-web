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
  assert.match(hook, /const fromPrice = await datafeed\.getPrice\(fromToken\.get\(\)\.symbol\);/);
  assert.match(hook, /const toPrice = await datafeed\.getPrice\(toToken\.get\(\)\.symbol\);/);
  assert.match(hook, /function setFromAmount\(value: string\)/);
  assert.match(hook, /fromAmount\.set\(value\);[\s\S]*onFromAmountChange\(\);/);
  assert.match(playArea, /dispatch\("setFromAmount", val\)/);
  assert.match(main, /ctx\.registerAction\("setFromAmount"/);
  assert.doesNotMatch(hook, /waitForSDK/);
});
