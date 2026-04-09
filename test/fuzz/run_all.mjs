#!/usr/bin/env node
/**
 * Continuous Fuzz Runner — runs all fuzz campaigns in sequence.
 *
 * Usage:
 *   node test/fuzz/run_all.mjs                    # Single pass
 *   FUZZ_CONTINUOUS=1 node test/fuzz/run_all.mjs   # Loop forever
 *   FUZZ_ITERATIONS=500 node test/fuzz/run_all.mjs # Custom iteration count
 *
 * Environment:
 *   TEST_FUZZ_WIF          — Funded testnet WIF (required for write fuzz)
 *   FUZZ_ITERATIONS        — Iterations per campaign (default: 100)
 *   FUZZ_CONTINUOUS        — Set to "1" for continuous loop
 *   FUZZ_LOOP_DELAY_MS     — Delay between loops (default: 60000)
 *   NEO_RPC_URL            — Testnet RPC (default: https://testnet1.neo.coz.io:443)
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTINUOUS = process.env.FUZZ_CONTINUOUS === "1";
const LOOP_DELAY = parseInt(process.env.FUZZ_LOOP_DELAY_MS || "60000", 10);

const campaigns = [
  "fuzz_contract_reads.mjs",
  "fuzz_contract_writes.mjs",
  "fuzz_cross_repo.mjs",
];

const reportDir = path.join(PROJECT_ROOT, "docs", "reports", "fuzz");
fs.mkdirSync(reportDir, { recursive: true });

async function runOnce(runId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  console.log(`\n${"=".repeat(60)}`);
  console.log(`FUZZ RUN ${runId} — ${timestamp}`);
  console.log("=".repeat(60));

  const results = { runId, timestamp, campaigns: {} };
  let hasFindings = false;

  for (const campaign of campaigns) {
    const scriptPath = path.join(SCRIPT_DIR, campaign);
    console.log(`\n--- ${campaign} ---`);

    try {
      const output = execFileSync("node", [scriptPath], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
        timeout: 600_000,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      console.log(output);
      results.campaigns[campaign] = { status: "pass", output: output.slice(-500) };
    } catch (err) {
      const output = (err.stdout || "") + (err.stderr || "");
      console.log(output);
      results.campaigns[campaign] = {
        status: err.status === 1 ? "findings" : "error",
        exitCode: err.status,
        output: output.slice(-500),
      };
      if (err.status === 1) hasFindings = true;
    }
  }

  // Write report
  const reportPath = path.join(reportDir, `fuzz-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2) + "\n");
  console.log(`\nReport: ${reportPath}`);

  return hasFindings;
}

// Main
let runId = 1;
do {
  const hasFindings = await runOnce(runId++);
  if (CONTINUOUS) {
    console.log(`\n[fuzz] Next run in ${LOOP_DELAY / 1000}s...`);
    await new Promise((r) => setTimeout(r, LOOP_DELAY));
  }
} while (CONTINUOUS);
