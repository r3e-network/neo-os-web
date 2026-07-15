#!/usr/bin/env node

/**
 * MiniApp layout-consistency audit.
 *
 * Every product app under apps/ must mount its UI through one of the
 * platform's first-class layout contracts:
 *
 *  1. React SDK runtime (current platform pattern) — `src/main.tsx` imports
 *     `defineMiniApp` from the shared SDK entry (`@shared/react` or
 *     `@shared/react/defineMiniApp`, i.e. apps/shared/react/defineMiniApp.tsx)
 *     and registers a `playArea:` component that resolves to a real local
 *     module. The audit follows the actual `playArea:` binding in the
 *     `defineMiniApp({...})` config instead of requiring one hardcoded
 *     filename, because the SDK contract is the binding, not the file name:
 *     DOM apps use `PlayArea.tsx`, Phaser games use `PhaserPlayArea.tsx`,
 *     and factory-style apps use names like `NftFactoryPlayArea.tsx` —
 *     all are the same first-class `defineMiniApp` layout.
 *  2. Shared factory runtime — the `defineMiniApp` config builds its play
 *     area with `createFactoryPlayArea(...)` from the shared factory runtime
 *     instead of a local component module.
 *  3. Legacy layouts (retained for the migration-era contract): a Vue
 *     runtime (`src/main.ts` + `defineMiniApp(` + `src/PlayArea.vue`) or a
 *     `src/pages/index/index.vue` page composed on `<MiniAppPage` /
 *     `<ConsoleMiniApp`.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const APPS_DIR = path.join(ROOT, "apps");
const PAGE_MARKERS = [
  "<MiniAppPage",
  "<ConsoleMiniApp",
];
const ACCEPTED_MARKERS = [
  "defineMiniApp(shared SDK) + playArea binding",
  "defineMiniApp(shared SDK) + createFactoryPlayArea runtime",
  "legacy Vue runtime (main.ts + PlayArea.vue)",
  ...PAGE_MARKERS,
];
// The shared SDK entrypoints that export defineMiniApp. Assert the actual
// import specifier so an app cannot pass with a local function that merely
// shares the name.
const SDK_ENTRY_SPECIFIERS = new Set([
  "@shared/react",
  "@shared/react/defineMiniApp",
]);
const MODULE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const ARCHIVED_APP_SLUGS = new Set(["neoburger", "neo-burger", "flamingo", "flaminggo"]);

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hasAcceptedPageLayout(filePath) {
  const source = readText(filePath);
  return PAGE_MARKERS.some((marker) => source.includes(marker));
}

/** Parse every `import ... from "specifier"` statement (multi-line safe). */
function parseImports(source) {
  const imports = [];
  const importRe = /import\s+([^;]+?)\s+from\s+["']([^"']+)["']/g;
  let match;
  while ((match = importRe.exec(source)) !== null) {
    imports.push({ bindings: match[1], specifier: match[2] });
  }
  return imports;
}

/** Local names bound by an import clause (default, named, and aliased). */
function importedNames(bindings) {
  return bindings
    .replace(/[{}]/g, ",")
    .split(",")
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0 && piece !== "type")
    .map((piece) => {
      const aliased = piece.match(/\bas\s+([A-Za-z_$][\w$]*)$/);
      if (aliased) return aliased[1];
      const plain = piece.match(/^(?:type\s+)?([A-Za-z_$][\w$]*)$/);
      return plain ? plain[1] : null;
    })
    .filter(Boolean);
}

/** Resolve a relative import specifier to an existing module file in src/. */
function resolveLocalModule(srcRoot, specifier) {
  const base = path.resolve(srcRoot, specifier);
  const candidates = [
    ...MODULE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...MODULE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

/**
 * Recognize the current React SDK layout: defineMiniApp imported from the
 * shared SDK entry, invoked with a config whose `playArea:` binding resolves
 * to a real local component module. Returns a human-readable marker string
 * describing exactly what matched, or null.
 */
function recognizeReactSdkLayout(appRoot) {
  const srcRoot = path.join(appRoot, "src");
  const mainPath = path.join(srcRoot, "main.tsx");
  if (!fs.existsSync(mainPath)) return null;
  const source = readText(mainPath);

  const imports = parseImports(source);
  const sdkImport = imports.find(
    (entry) =>
      SDK_ENTRY_SPECIFIERS.has(entry.specifier) &&
      importedNames(entry.bindings).includes("defineMiniApp"),
  );
  if (!sdkImport) return null;

  const callIndex = source.indexOf("defineMiniApp(");
  if (callIndex === -1) return null;
  const configSource = source.slice(callIndex);

  // Factory miniapps reuse the shared factory runtime instead of duplicating
  // nearly-identical local PlayArea modules per factory type.
  if (configSource.includes("createFactoryPlayArea(")) {
    return `defineMiniApp from "${sdkImport.specifier}" + shared createFactoryPlayArea runtime`;
  }

  const playAreaMatch = configSource.match(
    /\bplayArea\s*:\s*([A-Za-z_$][\w$]*)\s*[,}\r\n]/,
  );
  if (!playAreaMatch) return null;
  const identifier = playAreaMatch[1];

  const componentImport = imports.find(
    (entry) =>
      entry.specifier.startsWith(".") &&
      importedNames(entry.bindings).includes(identifier),
  );
  if (!componentImport) return null;

  const moduleFile = resolveLocalModule(srcRoot, componentImport.specifier);
  if (!moduleFile) return null;

  const relModule = path.relative(appRoot, moduleFile);
  return `defineMiniApp from "${sdkImport.specifier}" with playArea: ${identifier} → ${relModule}`;
}

/** Legacy Vue runtime shape from the pre-React migration era. */
function recognizeLegacyVueRuntime(appRoot) {
  const mainPath = path.join(appRoot, "src", "main.ts");
  const playPath = path.join(appRoot, "src", "PlayArea.vue");
  if (!fs.existsSync(mainPath) || !fs.existsSync(playPath)) return null;
  if (!readText(mainPath).includes("defineMiniApp(")) return null;
  return "legacy Vue runtime: src/main.ts defineMiniApp( + src/PlayArea.vue";
}

function main() {
  const entries = fs.readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "shared")
    .filter((name) => !ARCHIVED_APP_SLUGS.has(name.trim().toLowerCase()))
    .sort();

  const checked = [];
  const layouts = {};
  const failed = [];

  for (const app of entries) {
    const appRoot = path.join(APPS_DIR, app);
    const srcRoot = path.join(appRoot, "src");
    const pagePath = path.join(appRoot, "src/pages/index/index.vue");

    if (!fs.existsSync(srcRoot)) {
      continue;
    }

    checked.push(app);

    const marker =
      recognizeReactSdkLayout(appRoot) || recognizeLegacyVueRuntime(appRoot);
    if (marker) {
      layouts[app] = marker;
      continue;
    }

    if (fs.existsSync(pagePath) && hasAcceptedPageLayout(pagePath)) {
      layouts[app] = "legacy page: src/pages/index/index.vue with MiniAppPage/ConsoleMiniApp";
      continue;
    }

    failed.push(app);
  }

  console.log(JSON.stringify({
    checked_count: checked.length,
    accepted_markers: ACCEPTED_MARKERS,
    layouts,
    failed,
  }, null, 2));

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
