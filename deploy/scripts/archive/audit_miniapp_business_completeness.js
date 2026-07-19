#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const APPS_ROOT = path.join(REPO_ROOT, "apps");
const SHARED_ROOT = path.join(APPS_ROOT, "shared");
const HOST_PLAYAREA_ROOT = path.join(
  REPO_ROOT,
  "platform/host-app/components/playarea",
);
const REPORT_DIR = path.join(REPO_ROOT, "docs/reports");
const JSON_REPORT = path.join(
  REPORT_DIR,
  "miniapp-business-completeness-latest.json",
);
const MD_REPORT = path.join(
  REPORT_DIR,
  "miniapp-business-completeness-latest.md",
);

const CAPABILITIES = {
  query: /\b(load|read|refresh|fetch|get|query|search|lookup|resolve|inspect)\b/i,
  collection:
    /\b(list|history|recent|leaderboard|gallery|proposals?|bids?|escrows?|streams?|claims?|records?|templates?|certificates?|tickets?|guardians?|sessions?|permissions?|routes?|transactions?)\b/i,
  detail:
    /\b(detail|details|selected|select|modal|drawer|preview|inspect|expanded|viewDetails|openDetails)\b/i,
  status:
    /\b(status|state|progress|active|pending|completed|expired|revoked|passed|rejected|loading|empty)\b/i,
  execute:
    /\b(dispatch|registerAction|invoke|submit|create|vote|claim|deposit|withdraw|transfer|sign|mint|register|approve|cancel|release|finalize|revoke|execute|runPreview|primaryActionKey|buildResult)\b/i,
  result:
    /\b(result|success|tx|txHash|transaction|receipt|proof|hash|lastTx|submitted|confirmed|saved|created)\b/i,
  emptyError: /\b(empty|no[A-Z]\w+|notFound|error|failed|invalid|required|loading)\b/i,
  mobile:
    /(@media|sm:|md:|lg:|grid-template-columns|auto-fit|clamp\(|minmax\(|overflow-|line-clamp|aria-label|role=)/i,
};

const DOMAIN_REQUIREMENTS = {
  governance: ["query", "collection", "detail", "status", "execute", "result", "emptyError", "mobile"],
  aa: ["query", "collection", "detail", "status", "execute", "result", "emptyError", "mobile"],
  oracle: ["query", "collection", "detail", "status", "execute", "result", "emptyError", "mobile"],
  finance: ["query", "collection", "detail", "status", "execute", "result", "emptyError", "mobile"],
  game: ["query", "collection", "status", "execute", "result", "emptyError", "mobile"],
  social: ["query", "collection", "detail", "status", "execute", "result", "emptyError", "mobile"],
  tool: ["query", "detail", "status", "execute", "result", "emptyError", "mobile"],
};

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(full);
    return [full];
  });
}

function appSources(appDir) {
  const files = walkFiles(path.join(appDir, "src")).filter((file) =>
    /\.(ts|tsx|js|jsx|scss|css)$/.test(file),
  );
  return files.map(readText).join("\n");
}

function dirSources(dir) {
  return walkFiles(dir)
    .filter((file) => /\.(ts|tsx|js|jsx|scss|css)$/.test(file))
    .map(readText)
    .join("\n");
}

function supplementalSources(source) {
  const chunks = [];

  if (/createFactoryPlayArea|@shared\/factory|FactoryPlayArea/.test(source)) {
    chunks.push(dirSources(path.join(SHARED_ROOT, "factory")));
  }

  if (/ConsoleToolPanel|@shared\/components-react/.test(source)) {
    chunks.push(
      [
        "components-react/ConsoleToolPanel.tsx",
        "components-react/ConsoleToolPanel.scss",
        "components-react/NeoButton.tsx",
        "components-react/NeoButton.scss",
        "components-react/NeoInput.tsx",
        "components-react/NeoInput.scss",
        "components-react/NeoCard.tsx",
        "components-react/NeoCard.scss",
      ]
        .map((relative) => readText(path.join(SHARED_ROOT, relative)))
        .join("\n"),
    );
  }

  const forwardedPlayArea = source.match(
    /from\s+["']\.\.\/\.\.\/([^/"']+)\/src\/PlayArea["']/,
  );
  if (forwardedPlayArea) {
    chunks.push(dirSources(path.join(APPS_ROOT, forwardedPlayArea[1], "src")));
  }

  return chunks.join("\n");
}

function hostSources() {
  return walkFiles(HOST_PLAYAREA_ROOT)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => ({ file, text: readText(file) }));
}

function activeApps() {
  return fs
    .readdirSync(APPS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(APPS_ROOT, entry.name);
      const manifestPath = path.join(dir, "neo-manifest.json");
      if (!fs.existsSync(manifestPath)) return null;
      const manifest = readJson(manifestPath);
      const appId = manifest.app_id || manifest.id;
      if (!appId) return null;
      return {
        appId,
        name: manifest.name || appId,
        category: String(manifest.category || "tools"),
        dir,
        slug: entry.name,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.appId.localeCompare(right.appId));
}

function classifyDomain(app) {
  const text = `${app.appId} ${app.name} ${app.category}`.toLowerCase();
  if (/govern|anchor|council|merc/.test(text)) return "governance";
  if (/aa-|account abstraction|session|permission|relay|sponsor/.test(text))
    return "aa";
  if (/oracle|morpheus|vrf|compute|seal|price/.test(text)) return "oracle";
  if (/pay|loan|swap|escrow|fund|flash|treasury|transfer|defi|finance/.test(text))
    return "finance";
  if (/game|survivor|dice|fog|tarot|gasbox|checkin|burn/.test(text))
    return "game";
  if (/social|album|ticket|shrine|envelope|tipping|certificate|capsule|breakup/.test(text))
    return "social";
  return "tool";
}

function hostEvidenceFor(appId, hostFiles) {
  const direct = hostFiles
    .filter(({ text }) => text.includes(appId))
    .map(({ text }) => text)
    .join("\n");
  return direct;
}

function sourceFiles(appDir) {
  return walkFiles(path.join(appDir, "src")).filter((file) =>
    /\.(ts|tsx|js|jsx|scss|css)$/.test(file),
  );
}

function staleArtifacts(app) {
  return sourceFiles(app.dir)
    .map((file) => {
      const text = readText(file);
      const relative = path.relative(REPO_ROOT, file);
      const withoutImports = text.replace(/^\s*import[\s\S]*?;\s*/gm, "").trim();
      const reasons = [];

      if (
        /^export\s+default\s+function\s+\w+\s*\([^)]*\)\s*{\s*return\s+null\s*;?\s*}$/s.test(
          withoutImports,
        )
      ) {
        reasons.push("empty-return-null-component");
      }

      if (
        /return\s*\(\s*<div[^>]*>\s*{\s*\/\*\s*Migrated from .*\.vue\s*\*\/\s*}\s*<\/div>\s*\)\s*;?\s*}/is.test(
          withoutImports,
        )
      ) {
        reasons.push("empty-migrated-component");
      }

      if (/actions stay disabled/i.test(text)) {
        reasons.push("disabled-actions-placeholder");
      }

      return reasons.length ? { file: relative, reasons } : null;
    })
    .filter(Boolean);
}

function evaluate(app, hostFiles) {
  const domain = classifyDomain(app);
  const localSource = appSources(app.dir);
  const source = [
    readText(path.join(app.dir, "README.md")),
    readText(path.join(app.dir, "README.zh-CN.md")),
    readText(path.join(app.dir, "neo-manifest.json")),
    localSource,
    supplementalSources(localSource),
    hostEvidenceFor(app.appId, hostFiles),
  ].join("\n");

  const capabilities = Object.fromEntries(
    Object.entries(CAPABILITIES).map(([key, pattern]) => [key, pattern.test(source)]),
  );
  const required = DOMAIN_REQUIREMENTS[domain] || DOMAIN_REQUIREMENTS.tool;
  const missing = required.filter((key) => !capabilities[key]);
  const cleanupWarnings = staleArtifacts(app);

  return {
    appId: app.appId,
    name: app.name,
    domain,
    category: app.category,
    capabilities,
    missing,
    cleanupWarnings,
    status: missing.length
      ? "needs-business-follow-up"
      : cleanupWarnings.length
        ? "business-flow-present-with-cleanup"
        : "business-flow-evidence-present",
  };
}

function writeReports(rows) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const summary = {
    total: rows.length,
    passing: rows.filter((row) => row.missing.length === 0).length,
    needsFollowUp: rows.filter((row) => row.missing.length > 0).length,
    cleanupWarnings: rows.reduce(
      (total, row) => total + row.cleanupWarnings.length,
      0,
    ),
    byDomain: rows.reduce((acc, row) => {
      acc[row.domain] = (acc[row.domain] || 0) + 1;
      return acc;
    }, {}),
    gaps: rows
      .filter((row) => row.missing.length)
      .map((row) => ({
        appId: row.appId,
        domain: row.domain,
        missing: row.missing,
      })),
    cleanup: rows
      .filter((row) => row.cleanupWarnings.length)
      .map((row) => ({
        appId: row.appId,
        warnings: row.cleanupWarnings,
      })),
  };
  const generatedAt = new Date().toISOString();
  fs.writeFileSync(
    JSON_REPORT,
    JSON.stringify({ generatedAt, summary, rows }, null, 2),
  );

  const lines = [
    "# MiniApp Business Completeness Audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    "",
    `- Total active miniapps: ${summary.total}`,
    `- Business-flow evidence present: ${summary.passing}`,
    `- Needs follow-up: ${summary.needsFollowUp}`,
    `- Cleanup warnings: ${summary.cleanupWarnings}`,
    "",
    "## Strict Criteria",
    "",
    "Each app is checked for the business-facing capabilities that match its domain: query/read, list or history, detail, status, execute, result/proof, empty/error state, and responsive/mobile evidence.",
    "",
  ];

  if (summary.gaps.length) {
    lines.push("## Gaps", "");
    for (const gap of summary.gaps) {
      lines.push(
        `- ${gap.appId} (${gap.domain}): missing ${gap.missing.join(", ")}`,
      );
    }
    lines.push("");
  } else {
    lines.push("## Gaps", "", "- No static business-completeness gaps detected.", "");
  }

  if (summary.cleanup.length) {
    lines.push("## Cleanup Warnings", "");
    for (const item of summary.cleanup) {
      lines.push(`- ${item.appId}`);
      for (const warning of item.warnings) {
        lines.push(
          `  - ${warning.file}: ${warning.reasons.join(", ")}`,
        );
      }
    }
    lines.push("");
  }

  lines.push(
    "## App Matrix",
    "",
    "| App | Domain | Query | List/History | Detail | Status | Execute | Result | Empty/Error | Mobile | Status |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );

  for (const row of rows) {
    const mark = (key) => (row.capabilities[key] ? "yes" : "no");
    lines.push(
      `| ${row.appId} | ${row.domain} | ${mark("query")} | ${mark("collection")} | ${mark("detail")} | ${mark("status")} | ${mark("execute")} | ${mark("result")} | ${mark("emptyError")} | ${mark("mobile")} | ${row.status} |`,
    );
  }

  lines.push(
    "",
    "> This audit is stricter than surface smoke tests: it verifies that each app exposes enough source-level evidence for a complete user business workflow. It still must be paired with browser screenshots and live-chain signer tests before declaring production readiness.",
    "",
  );

  fs.writeFileSync(MD_REPORT, lines.join("\n"));
  return { summary, json: JSON_REPORT, markdown: MD_REPORT };
}

function main() {
  const hostFiles = hostSources();
  const rows = activeApps().map((app) => evaluate(app, hostFiles));
  const result = writeReports(rows);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.summary.needsFollowUp ? 1 : 0);
}

main();
