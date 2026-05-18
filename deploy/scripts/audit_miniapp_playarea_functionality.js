#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const APPS_ROOT = path.join(REPO_ROOT, "apps");
const BUILT_MINIAPPS_ROOT = path.join(
  REPO_ROOT,
  "platform/host-app/public/miniapps",
);
const REGISTRY_PATH = path.join(
  REPO_ROOT,
  "platform/host-app/components/playarea/PlayAreaRegistry.tsx",
);
const PLAYAREA_COMPONENTS_ROOT = path.dirname(REGISTRY_PATH);
const CONSOLE_TOOL_PATH = path.join(
  APPS_ROOT,
  "shared/components-react/ConsoleToolPanel.tsx",
);
const MINIAPP_OPERATION_PANEL_PATH = path.join(
  APPS_ROOT,
  "shared/components/MiniAppOperationPanel.tsx",
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

function readJson(filePath) {
  return JSON.parse(readText(filePath));
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
  const playareaSource = walkFiles(PLAYAREA_COMPONENTS_ROOT)
    .filter((filePath) => /PlayArea.*\.(tsx?|jsx?)$/.test(filePath))
    .map(readText)
    .join("\n");
  const customEntries = [
    ...registry.matchAll(/"(miniapp-[^"]+)":\s*(\w+PlayArea)/g),
  ].map((match) => [match[1], match[2]]);
  const customIds = new Set(customEntries.map(([appId]) => appId));
  const customComponents = new Map(customEntries);
  const profiledSection = [
    readText(path.join(PLAYAREA_COMPONENTS_ROOT, "PlayAreaProfilesAa.tsx")),
    readText(
      path.join(PLAYAREA_COMPONENTS_ROOT, "PlayAreaProfilesBusiness.tsx"),
    ),
  ].join("\n");
  const profiledIds = new Set(
    [...profiledSection.matchAll(/"(miniapp-[^"]+)":\s*\{/g)].map(
      (match) => match[1],
    ),
  );

  return {
    customIds,
    customComponents,
    profiledIds,
    registry,
    playareaSource,
    profiledSection,
  };
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return "";
  const end = endMarker
    ? source.indexOf(endMarker, start + startMarker.length)
    : -1;
  return source.slice(start, end === -1 ? source.length : end);
}

function extractFunctionSource(source, functionName) {
  const match = new RegExp(`function\\s+${functionName}\\s*\\(`).exec(source);
  if (!match) return "";

  const paramsStart = source.indexOf("(", match.index);
  if (paramsStart === -1) return "";

  let paramsDepth = 0;
  let paramsEnd = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") paramsDepth += 1;
    if (char === ")") paramsDepth -= 1;
    if (paramsDepth === 0) {
      paramsEnd = index;
      break;
    }
  }
  if (paramsEnd === -1) return "";

  const braceStart = source.indexOf("{", paramsEnd);
  if (braceStart === -1) return "";

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(match.index, index + 1);
  }
  return source.slice(match.index);
}

function profileEntrySource(appId, profiledSection) {
  const marker = `"${appId}":`;
  const start = profiledSection.indexOf(marker);
  if (start === -1) return "";

  const braceStart = profiledSection.indexOf("{", start);
  if (braceStart === -1) return "";

  let depth = 0;
  for (let index = braceStart; index < profiledSection.length; index += 1) {
    const char = profiledSection[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return profiledSection.slice(start, index + 1);
  }
  return profiledSection.slice(start);
}

function hostSourceForApp(appId, kind, kinds) {
  const playareaSource = kinds.playareaSource || kinds.registry;
  const pieces = [];
  const profiledSection = kinds.profiledSection || "";

  if (kind === "custom") {
    const componentName = kinds.customComponents.get(appId);
    const componentSource = componentName
      ? extractFunctionSource(playareaSource, componentName)
      : "";
    pieces.push(componentSource);

    for (const helperName of ["AnchorPlayArea", "AnchorAdminPlayArea"]) {
      if (componentSource.includes(`<${helperName}`)) {
        pieces.push(extractFunctionSource(playareaSource, helperName));
      }
    }
  } else if (kind === "oracle") {
    pieces.push(extractFunctionSource(playareaSource, "OracleConsolePlayArea"));
  } else if (kind === "profiled") {
    pieces.push(extractFunctionSource(playareaSource, "ProfiledPlayArea"));
    pieces.push(profileEntrySource(appId, profiledSection));
  } else {
    pieces.push(extractFunctionSource(playareaSource, "GenericPlayArea"));
  }

  return pieces.filter(Boolean).join("\n");
}

function loadManifests() {
  return fs
    .readdirSync(APPS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const slug = entry.name;
      const manifestPath = path.join(APPS_ROOT, slug, "neo-manifest.json");
      if (!fs.existsSync(manifestPath)) return null;
      const manifest = readJson(manifestPath);
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
          : countManifestOperations(manifest),
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
    source +=
      "\n" +
      readText(path.join(APPS_ROOT, "shared/factory/FactoryPlayArea.tsx"));
  }
  if (source.includes("ConsoleToolPanel")) {
    source += "\n" + readText(CONSOLE_TOOL_PATH);
  }
  if (source.includes("MiniAppOperationPanel")) {
    source += "\n" + readText(MINIAPP_OPERATION_PANEL_PATH);
  }
  return { source, mainSource, sourceFiles };
}

function countManifestOperations(manifest) {
  const candidates = [
    manifest.operations,
    manifest.operation_schema,
    manifest.operation_panel?.operations,
    manifest.detail_template?.operation_panel?.operations,
  ];
  const directCount = candidates.reduce(
    (count, value) => count + (Array.isArray(value) ? value.length : 0),
    0,
  );
  const moduleOps = Array.isArray(manifest.runtime?.modules)
    ? manifest.runtime.modules.reduce((count, module) => {
        const operations = module?.operations;
        return (
          count +
          (operations &&
          typeof operations === "object" &&
          !Array.isArray(operations)
            ? Object.keys(operations).length
            : 0)
        );
      }, 0)
    : 0;
  return directCount + moduleOps;
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
  const hostSource = hostSourceForApp(app.appId, kind, kinds);
  const combinedSource = `${source}\n${hostSource}`;
  const hasStandaloneSurface =
    /playArea\s*[:=]/.test(mainSource) ||
    mainSource.includes("createFactoryPlayArea") ||
    (mainSource.includes("defineMiniApp") && source.includes("PlayArea"));
  const builtIndexPath = builtIndexPathForApp(app);
  const hasBuiltIndex = Boolean(
    builtIndexPath && fs.existsSync(builtIndexPath),
  );
  const buttonCount = countMatches(combinedSource, /<NeoButton|<button/g);
  const inputCount = countMatches(
    combinedSource,
    /<NeoInput|<input|<select|<textarea|<ConsoleToolPanel|<MiniAppOperationPanel/g,
  );
  const surfaceControlCount = countMatches(
    combinedSource,
    /<ActionBoard|<EmbeddedDappSurface|useLaunchParamState\(|useLaunchChoiceState\(/g,
  );
  const actionCount = countMatches(
    combinedSource,
    /dispatch\(|registerAction\(|registerActions\(|actionMethod|onClick=|runPreview\(|fetch\(|buildResult|prepareMiniAppOperation|buildOraclePackage|sealOracleRequest|sealPrivateTransfer|explorerSearch|drawTarotReading|flipTarotReading/g,
  );
  const manifestOperationCount = countManifestOperations(app.manifest);
  const hasFileUpload = /type=["']file["']/.test(combinedSource);
  const sourceText = `${combinedSource}\n${JSON.stringify(app.manifest)}`;
  const workflowEvidence = workflowEvidenceForApp({
    source,
    hostSource,
    mainSource,
    hasStandaloneSurface,
    hasBuiltIndex,
    hasFileUpload,
    manifestOperationCount,
    actionCount,
    controlCount: buttonCount + inputCount + surfaceControlCount,
  });

  const gaps = [];
  if (!hasBuiltIndex) {
    gaps.push("built standalone dApp index missing");
  }
  if (kind === "generic") {
    gaps.push("platform uses generic fallback");
  }
  if ((kind === "profiled" || kind === "generic") && !hasStandaloneSurface) {
    gaps.push("profiled host surface has no standalone dApp to embed");
  }
  if (
    (kind === "custom" || kind === "oracle" || kind === "profiled") &&
    !hostSource.trim()
  ) {
    gaps.push("native host playarea source not found");
  }
  if (
    kind !== "oracle" &&
    buttonCount +
      inputCount +
      surfaceControlCount +
      actionCount +
      manifestOperationCount ===
      0
  ) {
    gaps.push("no detected user controls or app actions");
  }
  if (
    kind === "oracle" &&
    buttonCount +
      inputCount +
      surfaceControlCount +
      actionCount +
      manifestOperationCount ===
      0
  ) {
    gaps.push("oracle console has no request-builder controls");
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
  if (
    /coming soon|not implemented|status only|status-only|mock only/i.test(
      sourceText,
    )
  ) {
    gaps.push("source contains placeholder-only language");
  }
  if (
    /\b[Ss]tage\s+|staged status preview|Ready to submit|Local preview/.test(
      sourceText,
    )
  ) {
    gaps.push("source contains staging/status-only user-facing language");
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
    hasBuiltIndex,
    builtIndex:
      builtIndexPath && fs.existsSync(builtIndexPath)
        ? path.relative(REPO_ROOT, builtIndexPath)
        : null,
    sourceFileCount: sourceFiles.length,
    buttonCount,
    inputCount,
    surfaceControlCount,
    actionCount,
    operationsCount: manifestOperationCount,
    hasFileUpload,
    workflowEvidence,
    gaps,
    status: gaps.length === 0 ? "usable-surface-present" : "needs-follow-up",
  };
}

function builtIndexPathForApp(app) {
  const entry = String(app.entry || "").trim();
  if (entry.startsWith("/miniapps/") && entry.endsWith("/index.html")) {
    return path.join(
      REPO_ROOT,
      "platform/host-app/public",
      entry.replace(/^\//, ""),
    );
  }
  const slug = app.appId.replace(/^miniapp-/, "");
  return path.join(BUILT_MINIAPPS_ROOT, slug, "index.html");
}

function workflowEvidenceForApp({
  source,
  hostSource,
  mainSource,
  hasStandaloneSurface,
  hasBuiltIndex,
  hasFileUpload,
  manifestOperationCount,
  actionCount,
  controlCount,
}) {
  const evidence = [];
  if (hasBuiltIndex) evidence.push("built-static-dapp");
  if (hasStandaloneSurface) evidence.push("standalone-playarea");
  if (mainSource.includes("createFactoryPlayArea"))
    evidence.push("shared-factory-workflow");
  if (source.includes("ConsoleToolPanel")) evidence.push("console-tool-form");
  if (source.includes("MiniAppOperationPanel"))
    evidence.push("operation-panel-form");
  if (source.includes("registerAction") || source.includes("registerActions")) {
    evidence.push("registered-actions");
  }
  if (hostSource.includes("EmbeddedDappSurface"))
    evidence.push("host-embeds-real-dapp");
  if (hostSource.includes("ActionBoard")) evidence.push("native-action-board");
  if (hostSource.includes("fetch(") || source.includes("fetch("))
    evidence.push("live-api-call");
  if (hasFileUpload) evidence.push("file-upload");
  if (manifestOperationCount > 0) evidence.push("manifest-operations");
  if (actionCount > 0) evidence.push("action-handlers");
  if (controlCount > 0) evidence.push("interactive-controls");
  return [...new Set(evidence)];
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
    `- Real workflow coverage present: ${summary.status["usable-surface-present"] || 0}`,
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
    "| App | Surface | Built | Standalone | Controls | Actions | Evidence | Status |",
    "| --- | --- | --- | --- | ---: | ---: | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.appId} | ${row.platformSurface} | ${
          row.hasBuiltIndex ? "yes" : "no"
        } | ${
          row.hasStandaloneSurface ? "yes" : "no"
        } | ${row.buttonCount + row.inputCount + row.surfaceControlCount} | ${
          row.actionCount + row.operationsCount
        } | ${row.workflowEvidence.join(", ")} | ${row.status} |`,
    ),
    "",
    "> Scope: this audit verifies that every catalog miniapp has a built standalone dApp, a host surface, and detectable workflow evidence from source, manifest operations, or native playarea logic. It does not replace live mainnet/testnet signer execution for flows that require funded wallets or admin authority.",
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
