import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("defineMiniApp runtime creates one real platform service registry for the root", () => {
  const defineMiniApp = read("apps/shared/utils/defineMiniApp.ts");
  const rootComponent = read("apps/shared/components/MiniAppRoot.vue");

  assert.doesNotMatch(
    defineMiniApp,
    /createStubServices|Stub Platform Services|Stub service method/,
    "defineMiniApp should not rely on stub platform services",
  );

  assert.match(
    rootComponent,
    /PlatformServices\.create\(/,
    "MiniAppRoot should create the real PlatformServices instance",
  );

  assert.match(
    rootComponent,
    /services\s*=\s*PlatformServices\.create\(/,
    "MiniAppRoot should expose one canonical services object to the runtime",
  );
});

test("miniapp context typing exposes the real shared service surface", () => {
  const contextTypes = read("apps/shared/types/miniapp-context.ts");

  assert.match(
    contextTypes,
    /import type \{ PlatformServices \} from "\.\.\/services"/,
    "miniapp context should import the real PlatformServices type",
  );

  assert.doesNotMatch(
    contextTypes,
    /ctx\.services stub|provided as a fallback|readonly chain: unknown/,
    "miniapp context should no longer document or type services as stubbed unknowns",
  );

  assert.match(
    contextTypes,
    /services: PlatformServices;/,
    "miniapp context should expose the typed platform services surface",
  );
});

test("representative miniapps consume ctx.services instead of constructing PlatformServices manually", () => {
  for (const file of [
    "apps/oracle-compute-lab/src/main.ts",
    "apps/red-envelope/src/main.ts",
    "apps/fogplay/src/main.ts",
    "apps/daily-checkin/src/main.ts",
  ]) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /PlatformServices\.create\(/,
      `${file} should use the root-owned platform services`,
    );
    assert.doesNotMatch(
      source,
      /import \{ PlatformServices \} from "@shared\/services";/,
      `${file} should not import the PlatformServices constructor directly`,
    );
  }
});

test("platform audits inspect current runtime entrypoints instead of stale legacy page files", () => {
  const unifiedLayersAudit = read("deploy/scripts/audit_platform_unified_layers.js");
  const layoutAudit = read("deploy/scripts/verify_miniapp_layout_consistency.js");

  assert.match(
    unifiedLayersAudit,
    /src", "main\.ts"/,
    "unified layer audit should inspect current main.ts entrypoints",
  );
  assert.match(
    unifiedLayersAudit,
    /PlayArea\.vue/,
    "unified layer audit should understand PlayArea-based apps",
  );

  assert.match(
    layoutAudit,
    /main\.ts/,
    "layout audit should treat main.ts as a canonical runtime entrypoint",
  );
  assert.match(
    layoutAudit,
    /PlayArea\.vue/,
    "layout audit should validate PlayArea-based layout consistency",
  );
});
