import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAcceptanceLedger,
  renderAcceptanceMarkdown,
} from "../audit_platform_contract_acceptance.mjs";

test("platform contract acceptance ledger covers the complete nine-contract suite", () => {
  const ledger = buildAcceptanceLedger();

  assert.deepEqual(
    ledger.contracts.map((row) => row.name),
    [
      "PlatformRegistry",
      "AppAccount",
      "MiniAppFactory",
      "PlatformAnchor",
      "PlatformGame",
      "PlatformDeFi",
      "PlatformSocial",
      "PlatformVesting",
      "PlatformEscrow",
    ],
  );
  assert.equal(ledger.summary.contracts, 9);
  assert.deepEqual(
    ledger.factory_templates.map((row) => row.name),
    ["FactoryNep17Token", "FactoryNep11Collection"],
  );
  assert.equal(ledger.summary.factory_templates, 2);
});

test("platform contract source acceptance stays green without overstating deployment", () => {
  const ledger = buildAcceptanceLedger();

  assert.equal(ledger.summary.source_accepted, 9);
  assert.equal(ledger.summary.no_deployment_record, 3);
  assert.equal(
    ledger.contracts.find((row) => row.name === "PlatformSocial")
      ?.deployment_report_present,
    false,
  );
  assert.equal(ledger.summary.deployment_reports_present, 4);
  assert.equal(ledger.summary.partial_operational_evidence, 2);
  assert.equal(ledger.summary.current_testnet_artifact_matches, 2);
  assert.equal(ledger.summary.testnet_artifact_drifts, 4);
  assert.equal(ledger.live_testnet_evidence.read_only, true);
  assert.equal(ledger.live_testnet_evidence.chain_writes_performed, false);
  assert.equal(ledger.summary.factory_templates_source_accepted, 2);
  assert.equal(
    ledger.factory_templates.every((row) => row.checks.generated_hashes_fresh),
    true,
  );
  assert.equal(
    ledger.factory_templates.every((row) => row.checks.lifecycle_tests_present),
    true,
  );
  assert.equal(
    ledger.contracts.find((row) => row.name === "PlatformGame")
      ?.live_testnet?.status,
    "live-artifact-match",
  );
  assert.match(ledger.boundary, /historical evidence/i);
});

test("platform contract acceptance markdown preserves evidence boundaries", () => {
  const markdown = renderAcceptanceMarkdown(buildAcceptanceLedger());

  assert.match(markdown, /Source\/build\/test acceptance: 9\/9/);
  assert.match(markdown, /PlatformSocial/);
  assert.match(markdown, /no deployment record/);
  assert.match(markdown, /Current testnet artifact matches: 2\/9/);
  assert.match(markdown, /PlatformDeFi.*live-artifact-drift/);
  assert.match(markdown, /Factory templates source\/build\/lifecycle acceptance: 2\/2/);
  assert.match(markdown, /FactoryNep17Token.*NEP-17.*fresh.*accepted/);
});
