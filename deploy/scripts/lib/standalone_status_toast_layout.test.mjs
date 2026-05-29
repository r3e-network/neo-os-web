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

function cssBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "m"));
  assert.ok(match, `missing CSS selector: ${selector}`);
  return match[1];
}

test("standalone status toast stays in the bottom safe area instead of covering hero metrics", () => {
  const miniAppRoot = read("apps/shared/react/MiniAppRoot.tsx");
  const toastStyles = cssBlock(miniAppRoot, ".standalone-dapp-root .status-toast");
  const topDeclarations = [...toastStyles.matchAll(/top:\s*([^;]+);/g)].map((match) => match[1].trim());

  assert.match(toastStyles, /position:\s*fixed/);
  assert.deepEqual(topDeclarations, ["auto"]);
  assert.match(toastStyles, /bottom:\s*calc\(16px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
  assert.match(toastStyles, /max-width:\s*min\(calc\(100vw - 32px\),\s*520px\)/);
  assert.match(toastStyles, /pointer-events:\s*none/);
});
