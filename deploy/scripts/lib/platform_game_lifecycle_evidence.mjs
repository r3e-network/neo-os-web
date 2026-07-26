import fs from "node:fs";
import path from "node:path";

export const DEFAULT_LIFECYCLE_EVIDENCE_DIR = "docs/reports/platform-game-lifecycles";
export const REQUIRED_LIFECYCLE_CHECKS = Object.freeze([
  "app_registered",
  "pool_funded",
  "start_game_issued",
  "active_game_pointer_set",
  "finalize_submitted",
  "kernel_fulfill_completed",
  "winner_credit_posted",
  "settled_status",
  "active_game_pointer_cleared",
  "pool_accounting",
  "liability_identity",
  "credit_withdrawn",
]);
export const REQUIRED_LIFECYCLE_TXIDS = Object.freeze([
  "fund",
  "entry",
  "start_game",
  "finalize_game",
  "withdraw",
]);

function clean(value) {
  return String(value ?? "").trim();
}

function safeAppId(appId) {
  return clean(appId).replace(/[^a-zA-Z0-9._-]/g, "_") || "unknown-app";
}

export function lifecycleEvidencePath({
  repoRoot,
  appId,
  directory = DEFAULT_LIFECYCLE_EVIDENCE_DIR,
}) {
  return path.join(repoRoot, directory, `${safeAppId(appId)}.json`);
}

export function isCompleteLifecycleEvidence(
  report,
  { expectedNetwork = "neo-n3-testnet", expectedEngine = "" } = {},
) {
  if (!report || typeof report !== "object") return false;
  if (clean(report.status) !== "pass") return false;
  if (clean(report.network) !== expectedNetwork) return false;
  if (expectedEngine && clean(report.engine).toLowerCase() !== expectedEngine.toLowerCase()) {
    return false;
  }
  if (report.chain_writes_performed !== true) return false;
  const checks = report.checks;
  if (!checks || typeof checks !== "object") return false;
  if (!REQUIRED_LIFECYCLE_CHECKS.every((key) => checks[key] === true)) return false;
  const txids = report.txids;
  if (!txids || typeof txids !== "object") return false;
  return REQUIRED_LIFECYCLE_TXIDS.every((key) => clean(txids[key]) !== "");
}

export function loadLifecycleEvidence({
  repoRoot,
  directory = DEFAULT_LIFECYCLE_EVIDENCE_DIR,
  expectedNetwork = "neo-n3-testnet",
  expectedEngine = "",
} = {}) {
  const absoluteDirectory = path.join(repoRoot, directory);
  const reports = [];
  const invalid = [];
  if (!fs.existsSync(absoluteDirectory)) {
    return { directory: directory.replaceAll(path.sep, "/"), reports, invalid };
  }

  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const relativePath = path.join(directory, entry.name).replaceAll(path.sep, "/");
    try {
      const report = JSON.parse(fs.readFileSync(path.join(absoluteDirectory, entry.name), "utf8"));
      if (isCompleteLifecycleEvidence(report, { expectedNetwork, expectedEngine })) {
        reports.push({
          app_id: clean(report.app_id),
          path: relativePath,
          generated_at_utc: clean(report.generated_at_utc),
          txids: { ...report.txids },
        });
      } else {
        invalid.push({ path: relativePath, reason: "incomplete-or-mismatched-evidence" });
      }
    } catch {
      invalid.push({ path: relativePath, reason: "invalid-json" });
    }
  }
  return { directory: directory.replaceAll(path.sep, "/"), reports, invalid };
}

export function buildLifecycleEvidence({
  appId,
  engine,
  network = "neo-n3-testnet",
  status = "fail",
  chainWritesPerformed = false,
  checks = {},
  txids = {},
  values = {},
  parameters = {},
  generatedAt = () => new Date(),
} = {}) {
  return {
    schema: "neo-miniapps-platform/platform-game-lifecycle-evidence/v1",
    generated_at_utc: generatedAt().toISOString(),
    network,
    app_id: clean(appId),
    engine: clean(engine),
    status: status === "pass" ? "pass" : "fail",
    chain_writes_performed: chainWritesPerformed === true,
    checks: Object.fromEntries(
      REQUIRED_LIFECYCLE_CHECKS.map((key) => [key, checks[key] === true]),
    ),
    txids: Object.fromEntries(
      REQUIRED_LIFECYCLE_TXIDS.map((key) => [key, clean(txids[key]) || null]),
    ),
    values,
    parameters,
  };
}

export function writeLifecycleEvidence({
  repoRoot,
  report,
  directory = DEFAULT_LIFECYCLE_EVIDENCE_DIR,
} = {}) {
  const reportPath = lifecycleEvidencePath({ repoRoot, appId: report?.app_id, directory });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}
