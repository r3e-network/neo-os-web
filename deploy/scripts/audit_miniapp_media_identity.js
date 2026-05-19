#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const APPS_DIR = path.join(ROOT, "apps");
const DEFINITIONS_DIR = path.join(
  ROOT,
  "platform/host-app/public/miniapp-definitions",
);
const HOST_PUBLIC_DIR = path.join(ROOT, "platform/host-app/public");
const HOST_METADATA_ICON_FILES = [
  "platform/host-app/lib/miniapp-registration.ts",
  "platform/host-app/lib/miniapp-definitions.ts",
  "platform/host-app/lib/miniapp.ts",
  "platform/host-app/lib/oauth/store.ts",
  "platform/host-app/pages/api/miniapps/submit.ts",
  "platform/host-app/pages/api/miniapps/admin/status.ts",
  "platform/host-app/pages/developer.tsx",
  "apps/shared/types/miniapp-manifest.ts",
  "apps/shared/types/template-config.ts",
];
const ARCHIVED_APP_SLUGS = new Set([
  "flamingo",
  "flaminggo",
  "neo-burger",
  "neoburger",
]);
const OFFICIAL_SHARED_ICON_GROUPS = [
  new Set([
    "candidate-vote",
    "council-governance",
    "gov-merc",
    "secret-vote",
    "voting",
  ]),
];
const EMOJI_PATTERN = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listAppManifests() {
  return fs
    .readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => slug !== "shared")
    .filter((slug) => !ARCHIVED_APP_SLUGS.has(slug))
    .map((slug) => {
      const manifestPath = path.join(APPS_DIR, slug, "neo-manifest.json");
      if (!fs.existsSync(manifestPath)) return null;
      const manifest = readJson(manifestPath);
      return {
        scope: "app-manifest",
        slug,
        id: manifest.id || manifest.app_id || slug,
        file: path.relative(ROOT, manifestPath),
        icon: manifest.urls?.icon || manifest.media?.icon || manifest.icon || "",
        banner: manifest.urls?.banner || manifest.media?.banner || "",
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

function listDefinitionManifests() {
  if (!fs.existsSync(DEFINITIONS_DIR)) return [];
  return fs
    .readdirSync(DEFINITIONS_DIR)
    .filter((name) => name.endsWith(".json"))
    .filter((name) => !name.includes("schema"))
    .filter((name) => !name.includes("example"))
    .map((name) => {
      const filePath = path.join(DEFINITIONS_DIR, name);
      const manifest = readJson(filePath);
      const slug = name.replace(/\.json$/, "");
      return {
        scope: "definition",
        slug,
        id: manifest.app_id || manifest.id || slug,
        file: path.relative(ROOT, filePath),
        icon: manifest.media?.icon || manifest.icon || manifest.logo_url || "",
        banner: manifest.media?.banner || manifest.banner_url || "",
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

function resolveLocalAssetPath(assetPath, slug) {
  if (!assetPath.startsWith("/")) return true;

  if (assetPath.startsWith(`/miniapps/${slug}/`)) {
    const fileName = assetPath.slice(`/miniapps/${slug}/`.length);
    const appPublicPath = path.join(APPS_DIR, slug, "public", fileName);
    if (fs.existsSync(appPublicPath)) return appPublicPath;
    const hostPublicPath = path.join(HOST_PUBLIC_DIR, assetPath.slice(1));
    if (fs.existsSync(hostPublicPath)) return hostPublicPath;
    return null;
  }

  if (assetPath.startsWith(`/miniapp-assets/${slug}/`)) {
    const filePath = path.join(HOST_PUBLIC_DIR, assetPath.slice(1));
    return fs.existsSync(filePath) ? filePath : null;
  }

  const filePath = path.join(HOST_PUBLIC_DIR, assetPath.slice(1));
  return fs.existsSync(filePath) ? filePath : null;
}

function localAssetExists(assetPath, slug) {
  if (!assetPath.startsWith("/")) return true;
  return Boolean(resolveLocalAssetPath(assetPath, slug));
}

function validateScopedAsset(record, field, failures) {
  const value = record[field];
  if (!value) {
    failures.push({
      type: "missing-media",
      field,
      file: record.file,
      message: `${record.slug} has no ${field} asset`,
    });
    return;
  }

  if (EMOJI_PATTERN.test(value)) {
    failures.push({
      type: "emoji-media",
      field,
      file: record.file,
      value,
      message: `${record.slug} uses an emoji-like ${field}; use a real asset path`,
    });
  }

  const expectedPrefixes = [
    `/miniapps/${record.slug}/`,
    `/miniapp-assets/${record.slug}/`,
  ];
  if (
    value.startsWith("/") &&
    !expectedPrefixes.some((prefix) => value.startsWith(prefix))
  ) {
    failures.push({
      type: "cross-app-media",
      field,
      file: record.file,
      value,
      message: `${record.slug} points ${field} at another app asset path`,
    });
  }

  if (!localAssetExists(value, record.slug)) {
    failures.push({
      type: "missing-file",
      field,
      file: record.file,
      value,
      message: `${record.slug} ${field} asset path does not resolve locally`,
    });
  }
}

function validateUniqueAssets(records, field, failures) {
  const byValue = new Map();
  for (const record of records) {
    const value = record[field];
    if (!value) continue;
    const key = `${record.scope}:${value}`;
    const items = byValue.get(key) || [];
    items.push(record);
    byValue.set(key, items);
  }

  for (const [key, items] of byValue.entries()) {
    if (items.length <= 1) continue;
    failures.push({
      type: "duplicate-media-path",
      field,
      value: key.replace(/^[^:]+:/, ""),
      files: items.map((item) => item.file),
      message: `${items.length} ${items[0].scope} records share the same ${field} asset path`,
    });
  }
}

function validateUniqueAssetContent(records, field, failures) {
  const byHash = new Map();
  for (const record of records) {
    const value = record[field];
    if (!value || !value.startsWith("/")) continue;
    const filePath = resolveLocalAssetPath(value, record.slug);
    if (!filePath || typeof filePath !== "string") continue;
    const hash = require("crypto")
      .createHash("sha256")
      .update(fs.readFileSync(filePath))
      .digest("hex");
    const key = `${record.scope}:${hash}`;
    const items = byHash.get(key) || [];
    items.push({ ...record, resolvedFile: path.relative(ROOT, filePath) });
    byHash.set(key, items);
  }

  for (const [key, items] of byHash.entries()) {
    const distinctSlugs = new Set(items.map((item) => item.slug));
    if (distinctSlugs.size <= 1) continue;
    if (isAllowedSharedIconGroup(field, distinctSlugs)) continue;
    failures.push({
      type: "duplicate-media-content",
      field,
      hash: key.replace(/^[^:]+:/, ""),
      files: items.map((item) => item.resolvedFile),
      records: items.map((item) => item.file),
      message: `${items.length} ${items[0].scope} records share identical ${field} file contents`,
    });
  }
}

function isAllowedSharedIconGroup(field, slugs) {
  if (field !== "icon") return false;
  return OFFICIAL_SHARED_ICON_GROUPS.some((group) =>
    Array.from(slugs).every((slug) => group.has(slug)),
  );
}

function validateNoEmojiInHostMetadata(failures) {
  for (const relativePath of HOST_METADATA_ICON_FILES) {
    const filePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    if (!EMOJI_PATTERN.test(content)) continue;
    failures.push({
      type: "emoji-host-metadata",
      file: relativePath,
      message: `${relativePath} still contains emoji in miniapp/login metadata code`,
    });
  }
}

function main() {
  const appRecords = listAppManifests();
  const definitionRecords = listDefinitionManifests();
  const allRecords = [...appRecords, ...definitionRecords];
  const failures = [];

  for (const record of allRecords) {
    validateScopedAsset(record, "icon", failures);
    validateScopedAsset(record, "banner", failures);
  }

  validateUniqueAssets(appRecords, "icon", failures);
  validateUniqueAssets(appRecords, "banner", failures);
  validateUniqueAssets(definitionRecords, "icon", failures);
  validateUniqueAssets(definitionRecords, "banner", failures);
  validateUniqueAssetContent(appRecords, "icon", failures);
  validateUniqueAssetContent(appRecords, "banner", failures);
  validateUniqueAssetContent(definitionRecords, "icon", failures);
  validateUniqueAssetContent(definitionRecords, "banner", failures);
  validateNoEmojiInHostMetadata(failures);

  const result = {
    checked: {
      app_manifests: appRecords.length,
      definitions: definitionRecords.length,
    },
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) process.exit(1);
}

main();
