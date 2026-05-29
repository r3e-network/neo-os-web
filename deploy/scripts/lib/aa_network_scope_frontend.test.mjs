import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const AA_COMPOSABLES = [
  "apps/aa-account-lab/src/composables/useAAAccountLab.ts",
  "apps/aa-relay-console/src/composables/useAARelayConsole.ts",
  "apps/aa-session-key-lab/src/composables/useAASessionKeyLab.ts",
  "apps/aa-permissions-lab/src/composables/useAAPermissionsLab.ts",
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("AA frontends derive integration contracts from the selected launch network", () => {
  for (const relativePath of AA_COMPOSABLES) {
    const source = read(relativePath);
    assert.doesNotMatch(
      source,
      /getExternalIntegrationConfig\(\s*["']testnet["']\s*\)/,
      `${relativePath} must not hard-code the testnet AA integration`,
    );
  }

  const accountLab = read(
    "apps/aa-account-lab/src/composables/useAAAccountLab.ts",
  );
  const relayConsole = read(
    "apps/aa-relay-console/src/composables/useAARelayConsole.ts",
  );

  assert.match(accountLab, /getNetwork\(\)/);
  assert.match(relayConsole, /getNetwork\(\)/);
  assert.doesNotMatch(accountLab, /get:\s*\(\)\s*=>\s*t\(["']testnet["']\)/);
  assert.doesNotMatch(relayConsole, /get:\s*\(\)\s*=>\s*["']testnet["']/);
});
