import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const source = fs.readFileSync(path.join(repoRoot, 'deploy/scripts/deploy_platform_registry.go'), 'utf8');
const cohortSource = fs.readFileSync(
  path.join(repoRoot, 'deploy/scripts/register_apps_on_platform_registry.go'),
  'utf8',
);

test('PlatformRegistry verify supports a public signer identity without a WIF', () => {
  assert.match(source, /PLATFORM_REGISTRY_VERIFY_SIGNER/);
  assert.match(source, /signerInput = "public-identity"/);
  assert.match(source, /caller = invoker\.New\(client, nil\)/);
  assert.match(source, /mode = "read-only"/);
});

test('PlatformRegistry write-capable actions still require WIF and confirmation gates', () => {
  assert.match(source, /else if action == "verify"/);
  assert.match(source, /else if dryRun/);
  assert.match(source, /PLATFORM_REGISTRY_DRY_RUN_SIGNER/);
  assert.match(source, /Deployed: true/);
  assert.match(source, /create watch-only dry-run actor/);
  assert.match(source, /signer WIF is not configured/);
  assert.match(source, /CONFIRM_PLATFORM_REGISTRY_DEPLOY/);
  assert.match(source, /I_UNDERSTAND_THIS_WRITES_CHAIN/);
});

test('PlatformRegistry full-loop dry-run does not assume simulated state persists', () => {
  assert.match(source, /registrationSimulated := dryRun/);
  assert.match(source, /prFullLoopStepHasStatus\(record, "register-on-engine", "simulated"\)/);
  assert.match(source, /independent RPC dry-runs do not persist state/);
  assert.match(source, /Name: "descriptor", Status: "skipped", Note: dependentDryRunNote/);
  assert.match(source, /Name: "fund-pool", Status: "skipped", Note: dependentDryRunNote/);
});

test('PlatformRegistry admin mint lane does not plan an unnecessary credit top-up', () => {
  assert.match(source, /platformAdmin := admin == signerHash/);
  assert.match(source, /platform-admin mint lane is exempt from the 10 GAS registry fee/);
  assert.match(source, /if platformAdmin \{/);
});

test('cohort reconciliation accepts only a public identity for credential-free dry-runs', () => {
  assert.match(cohortSource, /PLATFORM_REGISTRY_DRY_RUN_SIGNER/);
  assert.match(cohortSource, /signerInput = "public-identity"/);
  assert.match(cohortSource, /create watch-only dry-run actor/);
  assert.match(cohortSource, /else if dryRun/);
  assert.match(cohortSource, /signer WIF is not configured/);
  assert.match(cohortSource, /CONFIRM_PLATFORM_REGISTRY_DEPLOY/);
  assert.match(cohortSource, /I_UNDERSTAND_THIS_WRITES_CHAIN/);
});

test('cohort reconciliation distinguishes directory rows from materialized accounts', () => {
  assert.match(cohortSource, /MaterializedAccounts\s+int\s+`json:"materialized_accounts"`/);
  assert.match(cohortSource, /EngineAttachedRows\s+int\s+`json:"engine_attached_rows"`/);
  assert.match(cohortSource, /ActiveRows\s+int\s+`json:"active_rows"`/);
  assert.match(cohortSource, /Materialized AppAccounts:/);
});

test('cohort account materialization is admin-only, dry-run-first, and bidirectionally verified', () => {
  assert.match(cohortSource, /PLATFORM_REGISTRY_COHORT_ACTION/);
  assert.match(cohortSource, /materialize-accounts/);
  assert.match(cohortSource, /account materialization requires the platform admin signer/);
  assert.match(cohortSource, /rrVerifyAccountRoundTrip/);
  assert.match(cohortSource, /materialized account %s does not match dry-run prediction %s/);
  assert.match(cohortSource, /predicted account hash duplicates app/);
  assert.match(cohortSource, /Review the per-app predicted hashes and aggregate system-fee estimate/);
});

test('cohort shared-AA materialization is upgrade-aware, admin-only, and reverse-index verified', () => {
  assert.match(cohortSource, /materialize-abstract-accounts/);
  assert.match(cohortSource, /PlatformRegistry upgrade required before shared abstract-account materialization/);
  assert.match(cohortSource, /cohort shared-account materialization requires the platform admin signer/);
  assert.match(cohortSource, /rrVerifyAbstractAccountRoundTrip/);
  assert.match(cohortSource, /materialized account id %s does not match dry-run prediction %s/);
  assert.match(cohortSource, /predicted shared account duplicates app/);
  assert.match(cohortSource, /it does not deploy 77 per-app contracts/);
});
