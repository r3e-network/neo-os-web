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

test("shared React cards render the expected content hook and wallet-style surfaces", () => {
  const cardComponent = read("apps/shared/components-react/NeoCard.tsx");
  const cardStyles = read("apps/shared/components-react/NeoCard.scss");

  assert.match(
    cardComponent,
    /className="neo-card__body neo-card__content"/,
    "NeoCard body should expose the content hook used by AA and recovery layouts",
  );

  assert.match(cardStyles, /border-radius:\s*var\(--card-radius,\s*12px\);/);
  assert.doesNotMatch(cardStyles, /linear-gradient/);
  assert.doesNotMatch(cardStyles, /text-transform:\s*uppercase/);
  assertOnlyZeroLetterSpacing(cardStyles);
});
