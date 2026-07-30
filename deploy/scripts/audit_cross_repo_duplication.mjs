#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultR3eRoot = path.resolve(scriptDir, "..", "..", "..");
// The clone family this audit measures is eleven game contracts. They were built
// in this repo when it still had contracts/; they are neo-os-minigames' now, so
// that is where the audit looks unless MINIAPPS_ROOT says otherwise.
const defaultMiniappsRoot = process.env.NEO_MINIGAMES_DIR
  ? path.resolve(process.env.NEO_MINIGAMES_DIR)
  : path.join(defaultR3eRoot, "neo-os-minigames");
const cloneFamilyNames = [
  "MiniAppAimMaster",
  "MiniAppColorClash",
  "MiniAppCurveArrow",
  "MiniAppFlappyDash",
  "MiniAppGame2048",
  "MiniAppJumpRush",
  "MiniAppMergeKingdom",
  "MiniAppPetPotion",
  "MiniAppSheepSolitaire",
  "MiniAppSnakeBounty",
  "MiniAppSudoku",
];

const toLines = (content) => {
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
};

const countLines = (content) => toLines(content).length;

const sha256 = (content) => createHash("sha256").update(content).digest("hex");

const relativeFiles = (root, predicate, ignoredDirectories = new Set()) => {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) stack.push(fullPath);
        continue;
      }
      if (predicate(fullPath)) files.push(path.relative(root, fullPath));
    }
  }
  return files.sort();
};

const measureFiles = (root, files) => ({
  files: files.length,
  loc: files.reduce(
    (total, relativePath) => total + countLines(fs.readFileSync(path.join(root, relativePath), "utf8")),
    0
  ),
});

export function alignedLineSimilarity(leftLines, rightLines) {
  const comparedLines = Math.max(leftLines.length, rightLines.length);
  let identicalLines = 0;
  for (let index = 0; index < comparedLines; index += 1) {
    if (leftLines[index] === rightLines[index]) identicalLines += 1;
  }
  return {
    compared_lines: comparedLines,
    identical_lines: identicalLines,
    differing_lines: comparedLines - identicalLines,
    identical_percent: comparedLines === 0
      ? 100
      : Number(((identicalLines / comparedLines) * 100).toFixed(2)),
  };
}

const contractLines = (contractsRoot, name) => {
  const contractRoot = path.join(contractsRoot, name);
  const files = fs.existsSync(contractRoot)
    ? fs.readdirSync(contractRoot).filter((file) => file.endsWith(".cs")).sort()
    : [];
  return {
    files,
    lines: files.flatMap((file) => toLines(fs.readFileSync(path.join(contractRoot, file), "utf8"))),
  };
};

const gitStatus = (repoRoot, relativePaths) => {
  try {
    return execFileSync("git", ["status", "--short", "--", ...relativePaths], {
      cwd: repoRoot,
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);
  } catch {
    return ["git-status-unavailable"];
  }
};

const countMatches = (root, files, pattern) =>
  files.reduce((total, relativePath) => {
    const content = fs.readFileSync(path.join(root, relativePath), "utf8");
    return total + [...content.matchAll(pattern)].length;
  }, 0);

const stripJavaScriptComments = (content) =>
  content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const isTestFile = (relativePath) =>
  /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/.test(relativePath);

const reviewedEngineNames = ["aim", "color", "flappy", "sheep"];

const reviewedHandwrittenEnginesOf = (syncSource) => reviewedEngineNames.map((name) => {
  const start = syncSource.indexOf(`name: '${name}'`);
  const end = start < 0 ? -1 : syncSource.indexOf("\n  },", start);
  const block = start < 0 ? "" : syncSource.slice(start, end < 0 ? undefined : end);
  if (!/action:\s*'keep'/.test(block)) return null;
  const source = block.match(/source:\s*'([^']+)'/)?.[1] ?? null;
  const reason = block.match(/reason:\s*'((?:\\.|[^'])+)'/)?.[1]?.replaceAll("\\'", "'") ?? null;
  return { name, source, reason };
}).filter(Boolean);

export function evaluateDuplicationEvidence(report) {
  const auditComplete = report.cloneFamily.all_exist &&
    report.cloneFamily.contracts === cloneFamilyNames.length &&
    report.morpheusEnginePorts.source_files === 12 &&
    report.morpheusEnginePorts.sync_pipeline.mapped_engines === 12 &&
    report.envelopeCopies.morpheus_exported &&
    report.sdkGenerations.framework.files > 0;
  const unresolved = [];
  if (report.cloneFamily.contracts > 0) unresolved.push("legacy-clone-contracts");
  if (report.morpheusEnginePorts.sync_pipeline.kept_engines > 0) {
    unresolved.push("reviewed-handwritten-engine-divergence");
  }
  if (report.envelopeCopies.aa_uses_vendored_copy) unresolved.push("aa-envelope-vendored-copy");
  if (report.sdkGenerations.ctx_os_runtime_reference_count > 0) {
    unresolved.push("ctx-os-runtime-proxies");
  }
  return {
    audit_complete: auditComplete,
    dedup_complete: auditComplete && unresolved.length === 0,
    unresolved,
  };
}

/**
 * One root per repo. This used to take a single `miniappsRoot` that held apps/,
 * contracts/, framework/ and platform/ at once - the monorepo shape. Those four
 * are in four repos now, so a single root resolved every one of them to the wrong
 * place and the audit died on the first read.
 */
export function buildCrossRepoDuplicationReport({
  // The eleven cloned game contracts and the build script that skips them.
  miniappsRoot = process.env.MINIAPPS_ROOT
    ? path.resolve(process.env.MINIAPPS_ROOT)
    : defaultMiniappsRoot,
  // framework/ and shared/, which the SDK-generations measurement compares.
  devpackRoot = process.env.DEVPACK_ROOT
    ? path.resolve(process.env.DEVPACK_ROOT)
    : path.join(defaultR3eRoot, "neo-os-devpack"),
  // platform/ and the contract deploy script.
  platformRoot = process.env.PLATFORM_ROOT
    ? path.resolve(process.env.PLATFORM_ROOT)
    : path.resolve(scriptDir, "..", ".."),
  abstractAccountRoot = process.env.AA_ROOT
    ? path.resolve(process.env.AA_ROOT)
    : path.join(defaultR3eRoot, "neo-abstract-account"),
  morpheusRoot = process.env.MORPHEUS_ORACLE_ROOT
    ? path.resolve(process.env.MORPHEUS_ORACLE_ROOT)
    : path.join(defaultR3eRoot, "neo-os-services"),
  now = () => new Date(),
} = {}) {
  for (const [name, root] of Object.entries({
    miniappsRoot,
    devpackRoot,
    platformRoot,
    abstractAccountRoot,
    morpheusRoot,
  })) {
    if (!fs.existsSync(root)) throw new Error(`${name} not found: ${root}`);
  }

  const contractsRoot = path.join(miniappsRoot, "contracts");
  const perContract = {};
  let totalLoc = 0;
  let totalCsFiles = 0;
  for (const name of cloneFamilyNames) {
    const measurement = contractLines(contractsRoot, name);
    perContract[name] = countLines(measurement.lines.join("\n"));
    totalLoc += perContract[name];
    totalCsFiles += measurement.files.length;
  }
  const aim = contractLines(contractsRoot, "MiniAppAimMaster");
  const color = contractLines(contractsRoot, "MiniAppColorClash");

  const engineRoot = path.join(
    morpheusRoot,
    "workers",
    "nitro-worker",
    "src",
    "game",
    "engines"
  );
  const engineFiles = fs.readdirSync(engineRoot)
    .filter((file) => file.endsWith(".js"))
    .sort();
  const adapterFiles = engineFiles.filter((file) => file.endsWith(".adapter.js"));
  const sourceFiles = engineFiles.filter((file) => !file.endsWith(".adapter.js"));
  const syncRelativePaths = [
    "scripts/sync-miniapp-game-engines.mjs",
    "scripts/sync-miniapp-game-engines.test.mjs",
    "workers/nitro-worker/src/game/engine-parity.goldens.json",
    "workers/nitro-worker/src/game/engine-parity.test.mjs",
  ];
  const syncSource = fs.readFileSync(path.join(morpheusRoot, syncRelativePaths[0]), "utf8");
  const deployScriptRelativePath = "deploy/scripts/deploy_selected_miniapp_contracts.go";
  const deployScriptSource = fs.readFileSync(path.join(platformRoot, deployScriptRelativePath), "utf8");
  const legacyTargetMarker = "var legacyCloneDeployTargets";
  const legacyTargetOffset = deployScriptSource.indexOf(legacyTargetMarker);
  const defaultDeploySource = legacyTargetOffset < 0
    ? deployScriptSource
    : deployScriptSource.slice(0, legacyTargetOffset);
  const legacyDeploySource = legacyTargetOffset < 0
    ? ""
    : deployScriptSource.slice(legacyTargetOffset);
  const legacyCloneDeployment = {
    script: deployScriptRelativePath,
    default_target_count: cloneFamilyNames.filter((name) =>
      defaultDeploySource.includes(`{"${name}"`)
    ).length,
    legacy_target_count: cloneFamilyNames.filter((name) =>
      legacyDeploySource.includes(`{"${name}"`)
    ).length,
    explicit_opt_in: deployScriptSource.includes("MINIAPP_DEPLOY_INCLUDE_LEGACY_CLONES"),
    legacy_manifest_writeback_disabled: cloneFamilyNames.every((name) =>
      legacyDeploySource.includes(`{"${name}", "contracts/build/${name}.nef", "contracts/build/${name}.manifest.json", ""}`)
    ),
  };
  const buildScriptRelativePath = "contracts/build.sh";
  const buildScriptSource = fs.readFileSync(path.join(miniappsRoot, buildScriptRelativePath), "utf8");
  const packageSource = fs.readFileSync(path.join(miniappsRoot, "package.json"), "utf8");
  const legacyCloneBuild = {
    script: buildScriptRelativePath,
    default_excluded: buildScriptSource.includes("BUILD_LEGACY_CLONES")
      && buildScriptSource.includes("is_legacy_clone_project")
      && buildScriptSource.includes("continue"),
    explicit_opt_in: buildScriptSource.includes("BUILD_LEGACY_CLONES")
      && packageSource.includes("BUILD_LEGACY_CLONES=1 npm run -s build:contracts"),
  };
  const reviewedHandwrittenEngines = reviewedHandwrittenEnginesOf(syncSource);

  const morpheusEnvelopePath = path.join(
    morpheusRoot,
    "packages",
    "shared",
    "src",
    "confidential-envelope.js"
  );
  const aaEnvelopePath = path.join(
    abstractAccountRoot,
    "frontend",
    "src",
    "utils",
    "morpheusEncryption.js"
  );
  const aaGeneratedEnvelopePath = path.join(
    abstractAccountRoot,
    "frontend",
    "src",
    "utils",
    "morpheusConfidentialEnvelope.generated.js"
  );
  const morpheusEnvelope = fs.readFileSync(morpheusEnvelopePath);
  const aaEnvelope = fs.readFileSync(aaEnvelopePath);
  const aaGeneratedEnvelope = fs.existsSync(aaGeneratedEnvelopePath)
    ? fs.readFileSync(aaGeneratedEnvelopePath)
    : Buffer.alloc(0);
  const morpheusEnvelopeSha256 = sha256(morpheusEnvelope);
  const aaGeneratedFromCanonical = aaGeneratedEnvelope.length > 0 &&
    aaGeneratedEnvelope.includes(Buffer.from(`Source sha256: ${morpheusEnvelopeSha256}.`)) &&
    aaGeneratedEnvelope.slice(-morpheusEnvelope.length).equals(morpheusEnvelope);
  const morpheusSharedPackage = JSON.parse(
    fs.readFileSync(path.join(morpheusRoot, "packages", "shared", "package.json"), "utf8")
  );
  const aaFrontendFiles = relativeFiles(
    path.join(abstractAccountRoot, "frontend", "src"),
    (file) => /\.[cm]?[jt]sx?$/.test(file),
    new Set(["node_modules", "dist", "build"])
  );

  const ignoredDirectories = new Set(["node_modules", "dist", "build", "coverage"]);
  const frameworkFiles = relativeFiles(
    path.join(devpackRoot, "framework"),
    (file) => file.endsWith(".ts"),
    ignoredDirectories
  );
  const serviceFiles = relativeFiles(
    path.join(devpackRoot, "shared", "services"),
    (file) => file.endsWith(".ts"),
    ignoredDirectories
  );
  const platformSdkFiles = relativeFiles(
    path.join(platformRoot, "platform", "sdk", "src"),
    (file) => file.endsWith(".ts"),
    ignoredDirectories
  );
  const appCodeRoot = path.join(miniappsRoot, "apps");
  const appCodeFiles = relativeFiles(
    appCodeRoot,
    (file) => /\.[cm]?[jt]sx?$/.test(file),
    new Set(["node_modules", "dist", "build", "coverage", "evidence"])
  );
  const appRuntimeFiles = appCodeFiles.filter((relativePath) => !isTestFile(relativePath));
  const ctxOsRuntimeReferenceCount = appRuntimeFiles.reduce((total, relativePath) => {
    const content = stripJavaScriptComments(
      fs.readFileSync(path.join(appCodeRoot, relativePath), "utf8")
    );
    return total + [...content.matchAll(/\bctx\.os\./g)].length;
  }, 0);

  const report = {
    schema_version: 2,
    generated_at_utc: now().toISOString(),
    cloneFamily: {
      root: "contracts/",
      contracts: cloneFamilyNames.length,
      all_exist: cloneFamilyNames.every((name) => fs.existsSync(path.join(contractsRoot, name))),
      cs_files: totalCsFiles,
      total_loc: totalLoc,
      pair_similarity: {
        baseline: "MiniAppAimMaster",
        comparison: "MiniAppColorClash",
        ...alignedLineSimilarity(aim.lines, color.lines),
      },
      per_contract: perContract,
      boundary: "All 11 legacy clone contracts remain in-tree for rollback and drain recovery. Framework routing is not deletion proof; the deployment helper excludes them by default and requires explicit MINIAPP_DEPLOY_INCLUDE_LEGACY_CLONES opt-in without manifest writeback.",
      build_boundary: legacyCloneBuild,
    },
    legacyCloneDeployment,
    morpheusEnginePorts: {
      dir: "neo-os-services/workers/nitro-worker/src/game/engines/",
      source_files: sourceFiles.length,
      source_file_list: sourceFiles,
      source_loc: measureFiles(engineRoot, sourceFiles).loc,
      adapter_files: adapterFiles.length,
      adapter_file_list: adapterFiles,
      sync_pipeline: {
        mapped_engines: [...syncSource.matchAll(/\bname:\s*'[^']+'/g)].length,
        generated_engines: [...syncSource.matchAll(/\baction:\s*'generate'/g)].length,
        kept_engines: [...syncSource.matchAll(/\baction:\s*'keep'/g)].length,
        script_exists: fs.existsSync(path.join(morpheusRoot, syncRelativePaths[0])),
        drift_test_exists: fs.existsSync(path.join(morpheusRoot, syncRelativePaths[1])),
        parity_goldens_exist: fs.existsSync(path.join(morpheusRoot, syncRelativePaths[2])),
        parity_test_exists: fs.existsSync(path.join(morpheusRoot, syncRelativePaths[3])),
        git_status: gitStatus(morpheusRoot, syncRelativePaths),
      },
      reviewed_handwritten_engines: reviewedHandwrittenEngines,
      boundary: `${[...syncSource.matchAll(/\baction:\s*'generate'/g)].length} engines are generated from miniapps TypeScript sources; ${[...syncSource.matchAll(/\baction:\s*'keep'/g)].length} remain reviewed handwritten ports and ${adapterFiles.length} enclave-only adapters remain. Dirty sibling-repo status is worktree evidence, not landed release proof.`,
    },
    envelopeCopies: {
      morpheus_file: "neo-os-services/packages/shared/src/confidential-envelope.js",
      aa_file: "neo-abstract-account/frontend/src/utils/morpheusEncryption.js",
      aa_generated_file: "neo-abstract-account/frontend/src/utils/morpheusConfidentialEnvelope.generated.js",
      morpheus_sha256: morpheusEnvelopeSha256,
      aa_sha256: sha256(aaEnvelope),
      aa_generated_sha256: aaGeneratedEnvelope.length > 0 ? sha256(aaGeneratedEnvelope) : null,
      byte_match: morpheusEnvelope.equals(aaEnvelope),
      aa_generated_from_canonical: aaGeneratedFromCanonical,
      morpheus_exported: Boolean(
        morpheusSharedPackage.exports?.["./confidential-envelope"]?.default
      ),
      aa_vendored_import_references: countMatches(
        path.join(abstractAccountRoot, "frontend", "src"),
        aaFrontendFiles,
        /morpheusEncryption/g
      ),
      aa_uses_vendored_copy: !aaGeneratedFromCanonical,
      boundary: aaGeneratedFromCanonical
        ? "AA keeps a thin browser adapter and a generated canonical envelope artifact; the sync script verifies the artifact source hash and exact canonical suffix before frontend use."
        : "The package export exists, but AA does not yet consume a generated canonical envelope artifact.",
    },
    sdkGenerations: {
      framework: measureFiles(path.join(devpackRoot, "framework"), frameworkFiles),
      services_proxy: measureFiles(
        path.join(devpackRoot, "shared", "services"),
        serviceFiles
      ),
      platform_sdk: measureFiles(path.join(platformRoot, "platform", "sdk", "src"), platformSdkFiles),
      framework_surface_files: frameworkFiles
        .filter((file) => file.endsWith("-surface.ts") && !file.includes("/test/"))
        .sort(),
      ctx_os_text_reference_count: countMatches(appCodeRoot, appCodeFiles, /\bctx\.os\./g),
      ctx_os_runtime_reference_count: ctxOsRuntimeReferenceCount,
      boundary: "node_modules/@r3e-network/neo-miniapp-framework/ is canonical app-facing API, apps/shared/services remains the live ctx.os compatibility runtime, and platform/sdk remains the iframe wallet-bridge protocol boundary.",
    },
  };
  return {
    ...report,
    ...evaluateDuplicationEvidence(report),
  };
}

export function writeCrossRepoDuplicationReport({ check = false, print = false } = {}) {
  const report = buildCrossRepoDuplicationReport();
  // The report is this repo's, whichever repos it measured. It used to be written
  // under defaultMiniappsRoot, which pointed here while the apps were here and
  // pointed at neo-os-minigames afterwards.
  const outputPath = path.resolve(
    scriptDir,
    "..",
    "..",
    "docs",
    "reports",
    "audit-findings-2026-07",
    "duplication.json"
  );
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (print) {
    process.stdout.write(json);
  } else if (check) {
    const existing = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    delete existing.generated_at_utc;
    const current = structuredClone(report);
    delete current.generated_at_utc;
    if (JSON.stringify(existing) !== JSON.stringify(current)) {
      throw new Error("cross-repo duplication report is stale");
    }
  } else {
    fs.writeFileSync(outputPath, json);
  }
  if (!report.audit_complete) throw new Error("cross-repo duplication evidence is incomplete");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = writeCrossRepoDuplicationReport({
    check: process.argv.includes("--check"),
    print: process.argv.includes("--print"),
  });
  if (!process.argv.includes("--print")) {
    console.log(
      `Cross-repo duplication audit: complete=${report.audit_complete}; dedup=${report.dedup_complete}; unresolved=${report.unresolved.length}`
    );
  }
}
