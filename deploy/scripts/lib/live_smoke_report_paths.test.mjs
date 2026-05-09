import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

const cases = [
  {
    file: "deploy/scripts/live_validate_selected_miniapps.js",
    envVar: "SELECTED_MINIAPP_SMOKE_REPORT_PATH",
    defaultPath: "docs/reports/live-smoke/selected-miniapps-latest.json",
  },
  {
    file: "deploy/scripts/live_validate_remaining_contracts_part1.js",
    envVar: "REMAINING_MINIAPP_SMOKE_PART1_REPORT_PATH",
    defaultPath: "docs/reports/live-smoke/remaining-contracts-part1.json",
  },
  {
    file: "deploy/scripts/live_validate_remaining_contracts_part2.js",
    envVar: "REMAINING_MINIAPP_SMOKE_PART2_REPORT_PATH",
    defaultPath: "docs/reports/live-smoke/remaining-contracts-part2.json",
  },
  {
    file: "deploy/scripts/live_validate_remaining_contracts_part3.js",
    envVar: "REMAINING_MINIAPP_SMOKE_PART3_REPORT_PATH",
    defaultPath: "docs/reports/live-smoke/remaining-contracts-part3.json",
  },
];

test("miniapp live smoke scripts write reports under docs/reports/live-smoke", () => {
  for (const { file, envVar, defaultPath } of cases) {
    const script = fs.readFileSync(path.join(repoRoot, file), "utf8");

    assert.match(script, new RegExp(envVar));
    const [, , reportDir, ...reportNameParts] = defaultPath.split("/");
    const reportName = reportNameParts.join(`", "`);
    assert.match(script, new RegExp(`"${reportDir}", "${reportName}"`));
    assert.doesNotMatch(script, /2026-03-19-remaining-miniapp-live-smoke-part[123]\.json/);
    assert.doesNotMatch(script, new RegExp(["2026", "03", "19", "selected-miniapp-live-smoke"].join("-")));
    assert.match(script, /fs\.mkdirSync\(path\.dirname\(OUTPUT_PATH\), \{ recursive: true \}\);/);
  }
});
