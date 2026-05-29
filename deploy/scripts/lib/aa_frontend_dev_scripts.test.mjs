import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const AA_FRONTEND_APPS = [
  "aa-account-lab",
  "aa-market-hub",
  "aa-permissions-lab",
  "aa-relay-console",
  "aa-session-key-lab",
  "recovery-guardian",
];

function readPackage(slug) {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, "apps", slug, "package.json"), "utf8"),
  );
}

test("AA frontend dev scripts use Vite so rendered QA can run locally", () => {
  for (const slug of AA_FRONTEND_APPS) {
    const pkg = readPackage(slug);
    const devScript = pkg.scripts?.dev || "";

    assert.match(
      devScript,
      /^vite\b/,
      `${slug} should start the miniapp with Vite`,
    );
    assert.doesNotMatch(
      devScript,
      /\buni\b/,
      `${slug} should not depend on a missing uni dev command`,
    );
  }
});
