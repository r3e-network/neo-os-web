#!/usr/bin/env node
/**
 * Verifies a split target repository is self-contained.
 *
 * The split moves thousands of files between different directory depths, so the
 * failure mode that matters is a relative import that used to resolve inside
 * the monorepo and now points at nothing (or worse, escapes the repo). This
 * resolves every relative specifier in the produced repo and reports the ones
 * that break, which is a far stronger check than eyeballing the transforms.
 *
 * Usage:
 *   node scripts/verify-split-repo.mjs ../neo-miniapp-sdk
 *   node scripts/verify-split-repo.mjs ../neo-os-minigames --json
 */
import fs from "node:fs";
import path from "node:path";

const target = path.resolve(process.argv[2] || "");
const asJson = process.argv.includes("--json");

if (!target || !fs.existsSync(target)) {
  console.error("verify-split-repo: pass the path to a produced repo");
  process.exit(2);
}

const SOURCE_EXT = [".ts", ".tsx", ".vue", ".mjs", ".js", ".jsx"];
const RESOLVE_EXT = ["", ".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs", ".cjs", ".json", ".vue", ".scss", ".css", ".svg", ".webp", ".png"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "bin", "obj", "coverage"]);

const SPECIFIER_RE =
  /((?:\bfrom\s*|\bimport\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bvi\s*\.\s*(?:mock|doMock|unmock)\s*\(\s*)(['"]))([^'"\n]+)(\2)/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (SOURCE_EXT.some((ext) => entry.name.endsWith(ext))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/**
 * Three shapes look like broken imports but are not:
 *  - Vite asset queries (`../x.svg?url`) - the query is not part of the path.
 *  - Template specifiers (`./scenes/${name}`) - resolved at runtime.
 *  - Import statements quoted inside doc comments or test assertions
 *    (`expect(src).toContain('from "./PhaserPlayArea"')`) - they are text.
 */
function classifySpec(spec, line) {
  if (spec.includes("${")) return "dynamic";
  const trimmed = line.trimStart();
  if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) return "comment";
  if (/\b(?:toContain|toBe|toEqual|toMatch|toStrictEqual)\s*\(|===\s*['"`]/.test(line)) return "assertion";
  // A line that is itself just a quoted string is an expected-value argument
  // spread across lines, e.g. expect(src).toContain(\n  'from "./X"',\n).
  if (/^['"`]/.test(trimmed)) return "assertion";
  return "real";
}

function resolves(fromFile, spec) {
  const withoutQuery = spec.replace(/[?#].*$/, "");
  const base = path.resolve(path.dirname(fromFile), withoutQuery);
  for (const ext of RESOLVE_EXT) {
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext;
  }
  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs"]) {
    const indexed = path.join(base, `index${ext}`);
    if (fs.existsSync(indexed)) return indexed;
  }
  // A directory with a package.json (rare inside these repos) counts as resolved.
  if (fs.existsSync(path.join(base, "package.json"))) return path.join(base, "package.json");
  return null;
}

const files = walk(target);
const unresolved = [];
const escaping = [];
const aliasCounts = new Map();
const bareCounts = new Map();

const ignored = { dynamic: 0, comment: 0, assertion: 0 };

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(SPECIFIER_RE)) {
    const spec = match[3];
    if (spec.startsWith(".")) {
      const lineStart = source.lastIndexOf("\n", match.index) + 1;
      const lineEnd = source.indexOf("\n", match.index);
      const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
      const kind = classifySpec(spec, line);
      if (kind !== "real") {
        ignored[kind] += 1;
        continue;
      }
      const abs = path.resolve(path.dirname(file), spec.replace(/[?#].*$/, ""));
      if (!abs.startsWith(target + path.sep)) {
        escaping.push({ file: path.relative(target, file), spec });
        continue;
      }
      if (!resolves(file, spec)) unresolved.push({ file: path.relative(target, file), spec });
      continue;
    }
    if (spec.startsWith("@shared") || spec.startsWith("@framework") || spec.startsWith("@/")) {
      const key = spec.split("/").slice(0, 2).join("/");
      aliasCounts.set(key, (aliasCounts.get(key) || 0) + 1);
      continue;
    }
    if (spec.startsWith("node:")) continue;
    const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    bareCounts.set(pkg, (bareCounts.get(pkg) || 0) + 1);
  }
}

const declared = (() => {
  const pkgPath = path.join(target, "package.json");
  if (!fs.existsSync(pkgPath)) return new Set();
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]);
})();

const workspaceDeclared = (() => {
  const set = new Set();
  for (const rel of ["framework/package.json", "shared/package.json"]) {
    const full = path.join(target, rel);
    if (!fs.existsSync(full)) continue;
    const pkg = JSON.parse(fs.readFileSync(full, "utf8"));
    for (const name of [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ]) {
      set.add(name);
    }
  }
  return set;
})();

const NODE_BUILTINS = new Set(["fs", "path", "url", "crypto", "os", "child_process", "util", "assert", "stream", "events", "http", "https", "zlib", "buffer", "module", "process"]);
const undeclared = [...bareCounts.entries()]
  .filter(([pkg]) => !declared.has(pkg) && !workspaceDeclared.has(pkg) && !NODE_BUILTINS.has(pkg))
  .sort((a, b) => b[1] - a[1])
  .map(([pkg, count]) => ({ package: pkg, imports: count }));

const report = {
  repo: path.basename(target),
  source_files_scanned: files.length,
  ignored_specifiers: ignored,
  unresolved_relative_imports: unresolved.length,
  imports_escaping_repo: escaping.length,
  alias_imports: Object.fromEntries([...aliasCounts.entries()].sort((a, b) => b[1] - a[1])),
  undeclared_bare_imports: undeclared,
  failures: {
    unresolved: unresolved.slice(0, 40),
    escaping: escaping.slice(0, 40),
  },
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`repo:                ${report.repo}`);
  console.log(`source files:        ${report.source_files_scanned}`);
  console.log(`unresolved imports:  ${report.unresolved_relative_imports}`);
  console.log(`escaping imports:    ${report.imports_escaping_repo}`);
  console.log(`alias imports:       ${JSON.stringify(report.alias_imports)}`);
  if (undeclared.length > 0) {
    console.log(`undeclared packages: ${undeclared.map((entry) => `${entry.package}(${entry.imports})`).join(", ")}`);
  }
  for (const entry of report.failures.escaping) console.log(`  ESCAPES  ${entry.file} -> ${entry.spec}`);
  for (const entry of report.failures.unresolved) console.log(`  MISSING  ${entry.file} -> ${entry.spec}`);
}

process.exit(unresolved.length > 0 || escaping.length > 0 ? 1 : 0);
