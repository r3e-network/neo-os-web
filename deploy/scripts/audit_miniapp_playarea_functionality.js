#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const APPS_ROOT = path.join(REPO_ROOT, "apps");
const REGISTRY_PATH = path.join(
  REPO_ROOT,
  "platform/host-app/components/playarea/PlayAreaRegistry.tsx",
);
const REPORT_DIR = path.join(REPO_ROOT, "docs/reports");
const JSON_REPORT = path.join(
  REPORT_DIR,
  "miniapp-playarea-functionality-latest.json",
);
const MD_REPORT = path.join(
  REPORT_DIR,
  "miniapp-playarea-functionality-latest.md",
);

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function parseRegistryKinds() {
  const registry = readText(REGISTRY_PATH);
  const customIds = new Set(
    [...registry.matchAll(/"(miniapp-[^"]+)":\s*\w+PlayArea/g)].map(
      (match) => match[1],
    ),
  );
  const profiledSection = registry.slice(
    registry.indexOf("const PROFILED_PLAYAREAS"),
    registry.indexOf("export function hasNativePlayArea"),
  );
  const profiledIds = new Set(
    [...profiledSection.matchAll(/"(miniapp-[^"]+)":\s*\{/g)].map(
      (match) => match[1],
    ),
  );

  return { customIds, profiledIds };
}

function loadManifests() {
  return fs
    .readdirSync(APPS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const slug = entry.name;
      const manifestPath = path.join(APPS_ROOT, slug, "neo-manifest.json");
      if (!fs.existsSync(manifestPath)) return null;
      const manifest = JSON.parse(readText(manifestPath));
      const appId = manifest.id || manifest.app_id;
      if (!appId) return null;
      return {
        slug,
        appId,
        name: manifest.name || appId,
        category: manifest.category || "utility",
        entry:
          manifest.urls?.entry ||
          `/miniapps/${appId.replace(/^miniapp-/, "")}/index.html`,
        operationsCount: Array.isArray(manifest.operations)
          ? manifest.operations.length
          : 0,
        manifest,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.appId.localeCompare(right.appId));
}

function sourceForApp(slug) {
  const appRoot = path.join(APPS_ROOT, slug);
  const srcRoot = path.join(appRoot, "src");
  const sourceFiles = walkFiles(srcRoot).filter((filePath) =>
    /\.(tsx?|jsx?)$/.test(filePath),
  );
  let source = sourceFiles.map(readText).join("\n");
  const mainSource = readText(path.join(srcRoot, "main.tsx"));
  if (mainSource.includes("createFactoryPlayArea")) {
    source += "\n" + readText(path.join(APPS_ROOT, "shared/factory/FactoryPlayArea.tsx"));
  }
  return { source, mainSource, sourceFiles };
}

function classifyKind(appId, kinds) {
  if (kinds.customIds.has(appId)) return "custom";
  if (appId.startsWith("miniapp-oracle-")) return "oracle";
  if (kinds.profiledIds.has(appId)) return "profiled";
  return "generic";
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

function auditApp(app, kinds) {
  const kind = classifyKind(app.appId, kinds);
  const { source, mainSource, sourceFiles } = sourceForApp(app.slug);
  const hasStandaloneSurface =
    /playArea\s*[:=]/.test(mainSource) ||
    mainSource.includes("createFactoryPlayArea");
  const buttonCount = countMatches(source, /<NeoButton|<button/g);
  const inputCount = countMatches(
    source,
    /<NeoInput|<input|<select|<textarea/g,
  );
  const actionCount = countMatches(source, /dispatch\(|registerAction\(/g);
  const hasFileUpload = /type=["']file["']/.test(source);
  const sourceText = `${source}\n${JSON.stringify(app.manifest)}`;

  const gaps = [];
  if (kind === "generic") {
    gaps.push("platform uses generic fallback");
  }
  if ((kind === "profiled" || kind === "generic") && !hasStandaloneSurface) {
    gaps.push("profiled host surface has no standalone dApp to embed");
  }
  if (
    kind !== "oracle" &&
    buttonCount + inputCount + actionCount + app.operationsCount === 0
  ) {
    gaps.push("no detected user controls or app actions");
  }
  if (/album|photo/i.test(`${app.appId} ${app.name}`) && !hasFileUpload) {
    gaps.push("photo/album app lacks file upload");
  }
  if (
    /council|governance/i.test(`${app.appId} ${app.name} ${app.category}`) &&
    !/proposal|vote/i.test(sourceText)
  ) {
    gaps.push("governance app lacks proposal/vote flow");
  }

  const platformSurface =
    kind === "profiled"
      ? "profiled host + embedded real dApp"
      : kind === "oracle"
        ? "oracle console playarea"
        : kind === "custom"
          ? "custom native playarea"
          : "generic host + embedded real dApp";

  return {
    appId: app.appId,
    slug: app.slug,
    name: app.name,
    category: app.category,
    platformSurface,
    entry: app.entry,
    hasStandaloneSurface,
    sourceFileCount: sourceFiles.length,
    buttonCount,
    inputCount,
    actionCount,
    operationsCount: app.operationsCount,
    hasFileUpload,
    gaps,
    status: gaps.length === 0 ? "usable-surface-present" : "needs-follow-up",
  };
}

function writeReports(rows) {
  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc.status[row.status] = (acc.status[row.status] || 0) + 1;
      acc.platformSurface[row.platformSurface] =
        (acc.platformSurface[row.platformSurface] || 0) + 1;
      if (row.gaps.length > 0) acc.gaps.push(row);
      return acc;
    },
    { total: 0, status: {}, platformSurface: {}, gaps: [] },
  );
  const generatedAt = new Date().toISOString();
  const payload = { generatedAt, summary, rows };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(JSON_REPORT, `${JSON.stringify(payload, null, 2)}\n`);

  const markdown = [
    "# MiniApp PlayArea Functionality Audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    "",
    `- Total active miniapps: ${summary.total}`,
    `- Usable PlayArea surface present: ${summary.status["usable-surface-present"] || 0}`,
    `- Needs follow-up: ${summary.status["needs-follow-up"] || 0}`,
    "",
    "## Platform Surface Coverage",
    "",
    ...Object.entries(summary.platformSurface)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([surface, count]) => `- ${surface}: ${count}`),
    "",
    "## Gaps",
    "",
    summary.gaps.length === 0
      ? "- No catalog-level PlayArea functionality gaps detected by this audit."
      : summary.gaps
          .map((row) => `- ${row.appId}: ${row.gaps.join("; ")}`)
          .join("\n"),
    "",
    "## App Matrix",
    "",
    "| App | Surface | Standalone | Controls | Actions | File Upload | Status |",
    "| --- | --- | --- | ---: | ---: | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.appId} | ${row.platformSurface} | ${
          row.hasStandaloneSurface ? "yes" : "no"
        } | ${row.buttonCount + row.inputCount} | ${
          row.actionCount + row.operationsCount
        } | ${row.hasFileUpload ? "yes" : "no"} | ${row.status} |`,
    ),
    "",
    "> Scope: this audit verifies that every catalog miniapp has a non-generic user surface and detectable business controls/actions. It does not replace live mainnet/testnet signer execution for flows that require funded wallets or admin authority.",
    "",
  ].join("\n");
  fs.writeFileSync(MD_REPORT, markdown);

  return payload;
}

function main() {
  const kinds = parseRegistryKinds();
  const rows = loadManifests().map((app) => auditApp(app, kinds));
  const payload = writeReports(rows);
  const gapCount = payload.summary.gaps.length;
  console.log(
    `Audited ${payload.summary.total} miniapps; ${gapCount} catalog-level PlayArea gaps.`,
  );
  console.log(`JSON report: ${path.relative(REPO_ROOT, JSON_REPORT)}`);
  console.log(`Markdown report: ${path.relative(REPO_ROOT, MD_REPORT)}`);
  if (gapCount > 0) process.exitCode = 1;
}

main();
