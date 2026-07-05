import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

export function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

export function assertClasses(source, classNames, label = "source") {
  for (const className of classNames) {
    assert.match(source, new RegExp(className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} missing ${className}`);
  }
}

export function assertDispatches(source, actionNames, label = "source") {
  for (const action of actionNames) {
    assert.match(source, new RegExp(`dispatch\\("${action}"`), `${label} missing dispatch("${action}")`);
  }
}

export function assertMessageKeys(source, keys, label = "messages") {
  for (const key of keys) {
    assert.match(source, new RegExp(`\\b${key}:`), `${label} missing ${key}`);
  }
}

export function assertAssets(paths) {
  for (const assetPath of paths) {
    assert.ok(exists(assetPath), `missing asset ${assetPath}`);
  }
}

export function assertPlayStage(source, category, label = "PlayArea") {
  assert.match(source, /<PlayStage\b/, `${label} should render PlayStage`);
  assert.match(source, new RegExp(`category="${category}"`), `${label} should use ${category} category`);
  assert.match(source, /actions=\{\{/, `${label} should expose stage actions`);
  assert.match(source, /drawerToggleLabel=/, `${label} should keep advanced controls in a drawer`);
}

export function assertModernTypography(styles, label = "styles") {
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/, `${label} should not scale type with viewport width`);
  const nonZeroTracking = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)]
    .map((match) => match[1].trim())
    .filter((value) => value !== "0" && value !== "0px" && value !== "normal");
  assert.deepEqual(nonZeroTracking, [], `${label} should keep letter spacing at 0`);
}

export function assertNoLegacyCards(source, label = "source") {
  assert.doesNotMatch(source, /<NeoCard\b/, `${label} should use the current v2/open UI surface, not legacy NeoCard`);
  assert.doesNotMatch(source, /<StateView\b/, `${label} should not fall back to old StateView pages`);
}
