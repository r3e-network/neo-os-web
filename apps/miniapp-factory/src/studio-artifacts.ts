import type {
  MiniAppCategory,
  MiniAppManifest,
  PlatformPermissions,
  ShellType,
  ThemeFamily,
} from "@shared/types/miniapp-manifest";
import type {
  FactoryArtifactPresence,
  FactoryPlan,
  MiniAppDraft,
} from "@shared/factory/factoryPlan";

export const MINIAPP_DRAFT_SCHEMA = "neo-miniapp-factory-draft:v1";
export const MINIAPP_BINDING_SCHEMA = "neo-miniapp-factory-binding:v1";
export const MINIAPP_PACKAGE_SCHEMA = "neo-miniapp-factory-package:v1";

export interface StoredMiniAppDraft {
  schema: typeof MINIAPP_DRAFT_SCHEMA;
  savedAt: string;
  draft: MiniAppDraft;
}

export interface MiniAppTemplateProfile {
  category: MiniAppCategory;
  description: string;
  icon: string;
  permissions: PlatformPermissions;
  shell: ShellType;
  themeFamily: ThemeFamily;
}

export interface MiniAppStudioArtifacts {
  bindingCode: string;
  bundleFileName: string;
  bundleJson: string;
  catalogPatchJson: string;
  manifestCode: string;
  manifest: MiniAppManifest;
  planJson: string;
}

const TEMPLATE_KINDS: readonly MiniAppDraft["templateKind"][] = [
  "reward-vault",
  "ticket-pass",
  "certificate",
  "oracle-console",
];

const TEMPLATE_PROFILES: Record<MiniAppDraft["templateKind"], MiniAppTemplateProfile> = {
  "reward-vault": {
    category: "defi",
    description: "Distribute wallet-backed rewards through a governed vault template",
    icon: "vault",
    permissions: { payments: true, storage: true },
    shell: "launcher",
    themeFamily: "finance",
  },
  "ticket-pass": {
    category: "social",
    description: "Issue and manage organizer-backed event passes",
    icon: "ticket",
    permissions: { payments: true, storage: true },
    shell: "market",
    themeFamily: "social",
  },
  certificate: {
    category: "social",
    description: "Issue wallet-bound certificates from a governed template",
    icon: "badge-check",
    permissions: { storage: true },
    shell: "launcher",
    themeFamily: "social",
  },
  "oracle-console": {
    category: "oracle",
    description: "Read and request Oracle data through a governed console template",
    icon: "radio-tower",
    permissions: { datafeed: true, oracle: true, storage: true },
    shell: "console",
    themeFamily: "default",
  },
};

function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function templateKind(value: unknown): MiniAppDraft["templateKind"] {
  const normalized = cleanText(value, 40) as MiniAppDraft["templateKind"];
  return TEMPLATE_KINDS.includes(normalized) ? normalized : "reward-vault";
}

export function normalizeMiniAppDraft(
  value: unknown,
  fallback: MiniAppDraft,
): MiniAppDraft {
  const source = isRecord(value) ? value : {};
  return {
    appId: cleanText(source.appId ?? fallback.appId, 80).toLowerCase(),
    appName: cleanText(source.appName ?? fallback.appName, 64),
    templateKind: templateKind(source.templateKind ?? fallback.templateKind),
    admin: cleanText(source.admin ?? fallback.admin, 64),
    // The current release has one verified Factory deployment. Never restore
    // an old mainnet draft into a UI that cannot execute it.
    network: "neo-n3-testnet",
    needsOracle: Boolean(source.needsOracle ?? fallback.needsOracle),
    needsOneGate: source.needsOneGate === undefined
      ? fallback.needsOneGate !== false
      : source.needsOneGate !== false,
  };
}

export function parseStoredMiniAppDraft(
  value: unknown,
  fallback: MiniAppDraft,
): MiniAppDraft | null {
  if (!isRecord(value) || value.schema !== MINIAPP_DRAFT_SCHEMA || !isRecord(value.draft)) {
    return null;
  }
  return normalizeMiniAppDraft(value.draft, fallback);
}

export function createStoredMiniAppDraft(draft: MiniAppDraft): StoredMiniAppDraft {
  return {
    schema: MINIAPP_DRAFT_SCHEMA,
    savedAt: new Date().toISOString(),
    draft: normalizeMiniAppDraft(draft, draft),
  };
}

export function templateProfile(kind: MiniAppDraft["templateKind"]): MiniAppTemplateProfile {
  return TEMPLATE_PROFILES[kind];
}

/**
 * The shared pure planner keeps miniapp digests reproducible without a chain
 * read. The production UI is stricter: an unavailable getTemplate read must
 * not enable the registration button because template existence is unknown.
 */
export function applyVerifiedTemplateGate(
  plan: FactoryPlan,
  presence: FactoryArtifactPresence | undefined,
): FactoryPlan {
  if (plan.kind !== "miniapp" || (presence !== undefined && presence !== "unknown")) {
    return plan;
  }
  return {
    ...plan,
    execution: {
      ...plan.execution,
      available: false,
      blockedReasonKey: "artifactUnverified",
    },
    steps: plan.steps.map((step) =>
      step.key === "deploy"
        ? { ...step, status: "manual", detailKey: "stepDeployUnverifiedDetail" }
        : step,
    ),
  };
}

function planInitParams(plan: FactoryPlan): Record<string, unknown> {
  return isRecord(plan.payload.initParams) ? plan.payload.initParams : {};
}

function planCatalogPatch(plan: FactoryPlan): Record<string, unknown> {
  const patch = planInitParams(plan).catalogPatch;
  return isRecord(patch) ? patch : {};
}

function quotedJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildMiniAppStudioArtifacts(plan: FactoryPlan): MiniAppStudioArtifacts {
  if (plan.kind !== "miniapp") {
    throw new Error("MiniApp Studio artifacts require a miniapp factory plan");
  }

  const initParams = planInitParams(plan);
  const kind = templateKind(initParams.templateKind);
  const profile = templateProfile(kind);
  const appId = cleanText(initParams.appId, 80).toLowerCase();
  const appName = cleanText(initParams.appName, 64);
  const capabilities = isRecord(initParams.capabilities) ? initParams.capabilities : {};
  const needsOracle = capabilities.oracle === true;
  const permissions: PlatformPermissions = {
    ...profile.permissions,
    ...(needsOracle ? { datafeed: true, oracle: true } : {}),
  };

  const manifest: MiniAppManifest = {
    name: appName,
    description: profile.description,
    icon: profile.icon,
    category: profile.category,
    shell: profile.shell,
    theme: {
      family: profile.themeFamily,
      accentColor: "#15966a",
      density: "comfortable",
    },
    // The generated app must own its product surface. These empty shell slots
    // avoid recreating a generic form/dashboard around it.
    tabs: [],
    stats: [],
    sidebar: { items: [] },
    features: { walletRequired: false, chainWarning: true },
    permissions,
    contract: { mode: "template", recipeId: plan.templateId },
  };

  const binding = {
    schema: MINIAPP_BINDING_SCHEMA,
    appId,
    packageId: plan.packageId,
    digest: plan.digest,
    network: plan.network,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
    initParams,
  };

  const registrationPlan = {
    packageId: plan.packageId,
    digest: plan.digest,
    network: plan.network,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
    templateArtifact: plan.templateArtifact,
    execution: plan.execution,
    registryCall: plan.deploymentCall,
    payload: plan.payload,
    oneGate: plan.oneGate,
  };
  const bundle = {
    schema: MINIAPP_PACKAGE_SCHEMA,
    appId,
    packageId: plan.packageId,
    digest: plan.digest,
    network: plan.network,
    outputs: {
      catalogPatch: planCatalogPatch(plan),
      manifest,
      factoryBinding: binding,
      registrationPlan,
    },
  };

  return {
    bundleFileName: `${appId || "miniapp-starter"}-${plan.digest.slice(-8)}.json`,
    bundleJson: quotedJson(bundle),
    catalogPatchJson: quotedJson(planCatalogPatch(plan)),
    manifest,
    manifestCode: [
      'import type { MiniAppManifest } from "@shared/types/miniapp-manifest";',
      "",
      "// Generated starter manifest. The operator must implement and verify",
      "// the template-specific PlayArea/setup before syncing the catalog patch.",
      `export const manifest: MiniAppManifest = ${quotedJson(manifest)};`,
      "",
    ].join("\n"),
    bindingCode: [
      "// Deterministic output of MiniApp Factory. Keep this beside the app",
      "// implementation so the operator can reproduce the registry commitment.",
      `export const factoryBinding = ${quotedJson(binding)} as const;`,
      "",
    ].join("\n"),
    planJson: quotedJson(registrationPlan),
  };
}
