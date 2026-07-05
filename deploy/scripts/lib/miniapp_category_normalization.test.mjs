import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG_CATEGORIES,
  normalizeCatalogCategory,
} from "../../../scripts/lib/miniapp-category.mjs";

test("normalizes miniapp catalog category aliases for exported catalogs", () => {
  assert.equal(normalizeCatalogCategory("games"), "gaming");
  assert.equal(normalizeCatalogCategory("game"), "gaming");
  assert.equal(normalizeCatalogCategory("tools"), "utility");
  assert.equal(normalizeCatalogCategory("tool"), "utility");
  assert.equal(normalizeCatalogCategory("finance"), "defi");
  assert.equal(normalizeCatalogCategory("oracle"), "data");
  assert.equal(normalizeCatalogCategory("social"), "social");
  assert.equal(normalizeCatalogCategory("unknown"), "utility");
});

test("catalog category normalizer only emits host-supported category ids", () => {
  for (const raw of ["games", "game", "tools", "tool", "finance", "oracle", "nft", "data", ""]) {
    assert.equal(CATALOG_CATEGORIES.has(normalizeCatalogCategory(raw)), true);
  }
});
