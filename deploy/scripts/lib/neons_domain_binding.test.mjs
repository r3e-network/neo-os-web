import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const PACKAGE_JSON = path.join(ROOT, "package.json");
const SCRIPT = path.join(ROOT, "deploy/scripts/bind_contract_domains.js");

test("NeoNS binding script is explicit about writes and secrets", () => {
  const source = fs.readFileSync(SCRIPT, "utf8");

  assert.match(source, /--execute/);
  assert.match(source, /NEONS_DOMAIN_OWNER_WIF/);
  assert.match(source, /required_env_keys/);
  assert.match(source, /simulateSetRecord/);
  assert.match(source, /sendSetRecord/);
  assert.match(source, /MAINNET_MAGIC/);
  assert.doesNotMatch(source, /console\.log\([^)]*WIF[^)]*value/);
});

test("root package exposes dry-run and execute NeoNS binding commands", () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));

  assert.equal(pkg.scripts["bind:contract-domains"], "node deploy/scripts/bind_contract_domains.js");
  assert.equal(pkg.scripts["bind:contract-domains:execute"], "node deploy/scripts/bind_contract_domains.js --execute");
});
