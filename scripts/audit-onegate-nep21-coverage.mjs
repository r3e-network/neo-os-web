#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATALOG_CATEGORIES,
  normalizeCatalogCategory,
} from "./lib/miniapp-category.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appsRoot = path.join(repoRoot, "apps");
const publicMiniappsRoot = path.join(
  repoRoot,
  "platform",
  "host-app",
  "public",
  "miniapps",
);
const archivedSlugs = new Set(["flamingo", "flaminggo", "neoburger", "neo-burger"]);

const checks = [];
const failures = [];
const warnings = [];

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function addCheck(name, ok, detail = {}) {
  checks.push({ name, ok, ...detail });
  if (!ok) failures.push({ name, ...detail });
}

function addWarning(name, detail = {}) {
  warnings.push({ name, ...detail });
}

function listSourceApps() {
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => slug !== "shared" && !archivedSlugs.has(slug))
    .filter((slug) => fs.existsSync(path.join(appsRoot, slug, "neo-manifest.json")))
    .sort()
    .map((slug) => {
      const manifest = readJson(path.join(appsRoot, slug, "neo-manifest.json"));
      return {
        slug,
        appId: asString(manifest.id || `miniapp-${slug}`),
        manifest,
      };
    });
}

function validateAbsoluteUrl(value, expectedPath) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.pathname === expectedPath;
  } catch {
    return false;
  }
}

function catalogBySlug(catalogApps) {
  return new Map(catalogApps.map((app) => [asString(app.slug), app]));
}

function validateCatalog(sourceApps) {
  const catalogPath = path.join(publicMiniappsRoot, "catalog.json");
  const onegateCatalogPath = path.join(publicMiniappsRoot, "onegate-catalog.json");
  const catalog = readJson(catalogPath);
  const onegateCatalog = readJson(onegateCatalogPath);
  const catalogApps = asArray(catalog.apps);
  const sourceBySlug = new Map(sourceApps.map((app) => [app.slug, app]));
  const bySlug = catalogBySlug(catalogApps);
  const onegateDapps = asArray(onegateCatalog.dapps);
  const onegateIds = new Map();

  addCheck("catalog.count_matches_source_manifests", catalogApps.length === sourceApps.length, {
    catalogCount: catalogApps.length,
    sourceManifestCount: sourceApps.length,
  });
  addCheck("onegate_catalog.count_matches_catalog", onegateDapps.length === catalogApps.length, {
    onegateCatalogCount: onegateDapps.length,
    catalogCount: catalogApps.length,
  });

  for (const source of sourceApps) {
    const app = bySlug.get(source.slug);
    const expectedEntry = `/miniapps/${source.slug}/index.html`;
    const sourceEntry = asString(asObject(source.manifest.urls).entry);
    addCheck(`catalog.${source.slug}.present`, Boolean(app), { appId: source.appId });
    if (!app) continue;

    const onegate = asObject(app.onegate);
    const onegateId = asString(onegate.id);
    const onegateUrl = asString(onegate.url);
    const dappUrl = asString(app.dapp_url);
    const dappAbsoluteUrl = asString(app.dapp_absolute_url);
    const duplicateOwner = onegateIds.get(onegateId);
    if (onegateId) onegateIds.set(onegateId, source.slug);

    addCheck(`catalog.${source.slug}.entry_is_standalone`, dappUrl === expectedEntry && sourceEntry === expectedEntry, {
      expectedEntry,
      dappUrl,
      sourceEntry,
    });
    addCheck(`catalog.${source.slug}.onegate_id`, /^[1-9][0-9]{0,9}$/.test(onegateId), {
      onegateId,
    });
    addCheck(`catalog.${source.slug}.onegate_id_unique`, !duplicateOwner, {
      onegateId,
      duplicateOwner,
    });
    addCheck(`catalog.${source.slug}.onegate_active`, onegate.isActive === true, {
      isActive: onegate.isActive,
    });
    addCheck(`catalog.${source.slug}.onegate_url_matches_dapp`, onegateUrl === dappAbsoluteUrl && validateAbsoluteUrl(onegateUrl, expectedEntry), {
      onegateUrl,
      dappAbsoluteUrl,
      expectedPath: expectedEntry,
    });
    addCheck(`catalog.${source.slug}.onegate_assets`, Boolean(onegate.iconUrl) && asArray(onegate.previews).length > 0, {
      iconUrl: Boolean(onegate.iconUrl),
      previews: asArray(onegate.previews).length,
    });
    addCheck(`catalog.${source.slug}.onegate_localized_metadata`, Boolean(onegate.name) && Boolean(onegate.description), {
      hasName: Boolean(onegate.name),
      hasDescription: Boolean(onegate.description),
    });
    addCheck(`catalog.${source.slug}.manifest_url`, asString(app.manifest_url) === `/miniapps/${source.slug}/neo-manifest.json`, {
      manifestUrl: asString(app.manifest_url),
    });
    const category = asString(app.category);
    const expectedCategory = normalizeCatalogCategory(source.manifest.category);
    addCheck(`catalog.${source.slug}.category_normalized`, CATALOG_CATEGORIES.has(category) && category === expectedCategory, {
      category,
      sourceCategory: asString(source.manifest.category),
      expectedCategory,
    });

    const matchingOnegateDapp = onegateDapps.find((entry) => asString(entry.id) === onegateId);
    addCheck(`onegate_catalog.${source.slug}.mirrors_catalog`, Boolean(matchingOnegateDapp) && asString(matchingOnegateDapp.url) === onegateUrl, {
      onegateId,
      onegateUrl,
    });
  }
}

function validateSourceContains(relativePath, checksForFile) {
  const source = readText(relativePath);
  for (const item of checksForFile) {
    const ok = item.pattern instanceof RegExp
      ? item.pattern.test(source)
      : source.includes(item.pattern);
    addCheck(`${relativePath}.${item.name}`, ok, {
      expected: String(item.pattern),
    });
  }
}

function validateWalletPath() {
  validateSourceContains("platform/sdk/src/nep21-provider.ts", [
    { name: "detects_nep21_global", pattern: "NEP21Provider" },
    { name: "detects_nep21_registry", pattern: "NEP21Providers" },
    { name: "detects_onegate_global", pattern: "OneGateDapiProvider" },
    { name: "requests_standard_ready_event", pattern: "Neo.DapiProvider.request" },
    { name: "waits_standard_ready_event", pattern: "Neo.DapiProvider.ready" },
  ]);
  validateSourceContains("platform/host-app/lib/wallet/adapters/nep21.ts", [
    { name: "uses_accounts", pattern: "provider.getAccounts()" },
    { name: "uses_authentication_fallback", pattern: "provider.authenticate" },
    { name: "supports_single_invoke", pattern: "async invoke(" },
    { name: "supports_batch_invoke", pattern: "async invokeMultiple" },
  ]);
  validateSourceContains("platform/host-app/lib/wallet/adapters/onegate.ts", [
    { name: "prefers_onegate_nep21", pattern: 'new Nep21Adapter("onegate")' },
    { name: "checks_nep21_first", pattern: "this.nep21.isInstalled()" },
    { name: "connects_nep21_first", pattern: /return\s+await\s+this\.nep21\.connect\(\)/ },
  ]);
  validateSourceContains("platform/host-app/lib/wallet/adapters/neoline.ts", [
    { name: "prefers_neoline_nep21", pattern: 'new Nep21Adapter("neoline")' },
    { name: "checks_nep21_first", pattern: "this.nep21.isInstalled()" },
    { name: "connects_nep21_first", pattern: /return\s+await\s+this\.nep21\.connect\(\)/ },
  ]);
  validateSourceContains("platform/host-app/lib/wallet/store.ts", [
    { name: "has_nep21_provider", pattern: /WalletProvider = "nep21".*"onegate"/s },
    { name: "exposes_onegate_wallet", pattern: 'id: "onegate"' },
    { name: "exposes_neoline_wallet", pattern: 'id: "neoline"' },
    { name: "recommends_onegate_wallet", pattern: /id: "onegate"[\s\S]*recommended: true/ },
    { name: "marks_nep21_protocol", pattern: 'protocol: "NEP-21"' },
  ]);
  validateSourceContains("apps/shared/utils/wallet-sdk.ts", [
    { name: "reads_nep21_provider", pattern: "readImmediateNep21Provider" },
    { name: "waits_nep21_provider", pattern: "waitForNep21Provider" },
    { name: "sets_nep21_active_provider", pattern: 'kind: "nep21"' },
    { name: "connects_nep21", pattern: "connectDapi(wallet.provider)" },
    { name: "invokes_nep21", pattern: "wallet.provider.invoke" },
    { name: "reads_nep21", pattern: "wallet.provider.call" },
    { name: "balances_nep21", pattern: "wallet.provider.getBalance" },
    { name: "signs_nep21", pattern: "wallet.provider.signMessage" },
  ]);
  validateSourceContains("apps/shared/utils/onegate-launch.ts", [
    { name: "uses_onegate_app_base", pattern: "https://onegate.space/app" },
    { name: "builds_launch_url", pattern: "buildOneGateLaunchUrl" },
    { name: "builds_direct_miniapp_url", pattern: "buildOneGateDirectMiniAppUrl" },
    { name: "generates_stable_dapp_id", pattern: "stableOneGateDappId" },
    { name: "sets_onegate_source", pattern: 'url.searchParams.set("source", "onegate")' },
  ]);
  validateSourceContains("platform/host-app/pages/miniapps/[id].tsx", [
    { name: "resolves_onegate_dapp_id", pattern: "resolveOneGateDappId(app)" },
    { name: "builds_onegate_launch_url", pattern: "buildOneGateLaunchUrl(app.app_id" },
    { name: "builds_direct_fallback_url", pattern: "buildOneGateDirectMiniAppUrl" },
    { name: "renders_onegate_qr", pattern: "oneGateLaunchUrl" },
  ]);
  validateSourceContains("platform/host-app/middleware.ts", [
    { name: "allows_onegate_frame_ancestor", pattern: "https://onegate.space" },
    { name: "has_native_wallet_eval_switch", pattern: "allowNativeWalletEval" },
  ]);
}

function collectSource(slug) {
  const srcDir = path.join(appsRoot, slug, "src");
  if (!fs.existsSync(srcDir)) return "";
  const stack = [srcDir];
  let output = "";
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        output += `\n/* ${path.relative(repoRoot, child)} */\n`;
        output += fs.readFileSync(child, "utf8");
      }
    }
  }
  return output;
}

function collectExistingSource(relativePaths) {
  return relativePaths
    .map((relativePath) => {
      const absolutePath = path.join(repoRoot, relativePath);
      if (!fs.existsSync(absolutePath)) return "";
      return `\n/* ${relativePath} */\n${fs.readFileSync(absolutePath, "utf8")}`;
    })
    .join("\n");
}

const sharedWalletRuntimeSource = collectExistingSource([
  "apps/shared/services/ChainService.ts",
  "apps/shared/services/TransferService.ts",
  "apps/shared/services/os/EdgeClient.ts",
  "apps/shared/services/os/PaymentProxy.ts",
  "apps/shared/services/os/GameProxy.ts",
  "apps/shared/services/os/CheckinProxy.ts",
  "apps/shared/factory/runtime.tsx",
]);

function usesSharedWalletRuntime(source) {
  return /ctx\.services\.chain|services\.chain|ctx\.os\.|createFactorySetup|@shared\/factory\/runtime|PaymentProxy|GameProxy|CheckinProxy/.test(
    source,
  );
}

function manifestFlags(manifest) {
  const tags = asArray(manifest.tags).map((tag) => asString(tag).toLowerCase());
  const permissions = asObject(manifest.permissions);
  const permissionArray = asArray(manifest.permissions).map((item) => asString(item).toLowerCase());
  return {
    aa:
      tags.includes("aa") ||
      Boolean(permissions.aa) ||
      permissionArray.some((item) => item.startsWith("aa:")),
    morpheus: tags.includes("morpheus"),
    oracle:
      tags.includes("oracle") ||
      Boolean(permissions.oracle) ||
      permissionArray.some((item) => item.includes("oracle")),
    wallet:
      tags.includes("wallet") ||
      permissionArray.some((item) => item.includes("wallet") || item.startsWith("invoke:")),
  };
}

function validateDomainApps(sourceApps) {
  const domainApps = [];
  let walletIntegrated = 0;
  let morpheusIntegrated = 0;
  let aaIntegrated = 0;

  for (const app of sourceApps) {
    const flags = manifestFlags(app.manifest);
    if (!flags.aa && !flags.morpheus && !flags.oracle && !flags.wallet) continue;
    domainApps.push({ app, flags });
    const source = collectSource(app.slug);
    const sourceForAudit = usesSharedWalletRuntime(source)
      ? `${source}\n${sharedWalletRuntimeSource}`
      : source;
    const hasRuntime = source.includes("defineMiniApp(");
    const hasWalletPath =
      /useWallet\(|ChainService|chain\.ensureWallet|services\.chain|ctx\.services\.chain|wallet\.connect|invokeContract|invokeMultiple|invokeWithPayment|invokeWithDirectPrepaidGas|signMessage|ctx\.os\.|OSServiceProxy|EdgeClient|PaymentProxy|GameProxy|CheckinProxy|createFactorySetup/.test(
        sourceForAudit,
      );
    const hasAaPath = /ctx\.services\.aa|services\.aa|AAService|submitRelay|checkSponsorship|requestSponsor/.test(
      sourceForAudit,
    );
    const hasMorpheusPath =
      /\/api\/morpheus|Morpheus|getExternalIntegrationConfig|morpheus|sealOracleRequest|buildOraclePackage|oracle/i.test(
        sourceForAudit,
      );
    const hasTransactionPath = hasWalletPath || (flags.aa && hasAaPath);

    addCheck(`domain.${app.slug}.uses_shared_runtime`, hasRuntime, {
      appId: app.appId,
    });

    if ((flags.aa || flags.wallet) && hasTransactionPath) walletIntegrated += 1;
    if (flags.aa && hasTransactionPath) aaIntegrated += 1;
    if ((flags.morpheus || flags.oracle) && hasMorpheusPath) morpheusIntegrated += 1;

    if ((flags.aa || flags.wallet) && !hasTransactionPath) {
      addWarning(`domain.${app.slug}.no_direct_wallet_call_detected`, {
        appId: app.appId,
        reason: "App may rely on manifest/host operation panels; review manually if it should submit transactions inside the standalone dApp.",
      });
    }
    if ((flags.morpheus || flags.oracle) && !hasMorpheusPath) {
      addWarning(`domain.${app.slug}.no_morpheus_or_oracle_call_detected`, {
        appId: app.appId,
        reason: "App may be a planning UI or use host/native playarea integration; review manually if it should call Morpheus directly.",
      });
    }
  }

  addCheck("domain.aa_wallet_paths_present", aaIntegrated > 0, { aaIntegrated });
  addCheck("domain.wallet_paths_present", walletIntegrated > 0, { walletIntegrated });
  addCheck("domain.morpheus_or_oracle_paths_present", morpheusIntegrated > 0, {
    morpheusIntegrated,
  });

  return {
    domainAppCount: domainApps.length,
    walletIntegrated,
    aaIntegrated,
    morpheusIntegrated,
  };
}

const sourceApps = listSourceApps();
validateCatalog(sourceApps);
validateWalletPath();
const domainSummary = validateDomainApps(sourceApps);

const summary = {
  generated_at: new Date().toISOString(),
  source_app_count: sourceApps.length,
  checks: checks.length,
  failures: failures.length,
  warnings: warnings.length,
  ...domainSummary,
};

console.log(JSON.stringify({ summary, failures, warnings }, null, 2));

if (failures.length > 0) process.exit(1);
