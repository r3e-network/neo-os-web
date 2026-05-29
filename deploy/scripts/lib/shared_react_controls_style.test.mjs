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

function assertOnlyZeroLetterSpacing(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected at least one letter-spacing declaration");
  assert.deepEqual(values, values.map(() => "0"));
}

test("shared React controls keep wallet-style typography and readable disabled states", () => {
  const buttonStyles = read("apps/shared/components-react/NeoButton.scss");
  const inputStyles = read("apps/shared/components-react/NeoInput.scss");
  const selectStyles = read("apps/shared/components-react/NeoSelect.scss");
  const selectComponent = read("apps/shared/components-react/NeoSelect.tsx");

  assert.match(buttonStyles, /\.neo-btn\s*\{[^}]*letter-spacing:\s*0;/s);
  assert.match(inputStyles, /&__label\s*\{[^}]*letter-spacing:\s*0;/s);
  assertOnlyZeroLetterSpacing(buttonStyles);
  assertOnlyZeroLetterSpacing(inputStyles);

  assert.match(buttonStyles, /&:disabled\s*\{[^}]*opacity:\s*1;/s);
  assert.match(inputStyles, /&--disabled\s*\{[^}]*opacity:\s*1;/s);
  assert.doesNotMatch(buttonStyles, /opacity:\s*0\.5/);
  assert.doesNotMatch(inputStyles, /opacity:\s*0\.5/);

  assert.match(selectStyles, /background-color:\s*transparent;/);
  assert.match(selectStyles, /padding-right:\s*14px;/);
  assert.doesNotMatch(selectComponent, /neo-select__chevron/);
  assert.doesNotMatch(selectStyles, /&__chevron/);
});
