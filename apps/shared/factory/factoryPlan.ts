import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { buildOneGateLaunchUrl } from "@shared/utils/onegate-launch";

export type FactoryKind = "nep17" | "nep11" | "miniapp";
export type FactoryNetwork = "neo-n3-mainnet" | "neo-n3-testnet";
export type FactoryStepStatus = "ready" | "manual" | "blocked";
export type FactoryTemplateStatus = "preloaded-on-chain";

export interface FactoryContractArg {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "ByteArray";
  value: string | number | boolean;
}

export interface FactoryStep {
  key: string;
  title: string;
  detail: string;
  status: FactoryStepStatus;
}

export interface FactoryPlan {
  kind: FactoryKind;
  title: string;
  network: FactoryNetwork;
  templateRef: string;
  templateId: string;
  templateVersion: string;
  templateArtifact: {
    status: FactoryTemplateStatus;
    nefHash: string;
    manifestHash: string;
    configSchemaHash: string;
  };
  operation: string;
  deploymentCall: {
    scriptHash: string;
    operation: string;
    args: FactoryContractArg[];
  };
  packageId: string;
  digest: string;
  publishable: boolean;
  blockingErrors: string[];
  warnings: string[];
  payload: Record<string, unknown>;
  steps: FactoryStep[];
  oneGate: {
    url: string;
    params: Record<string, string>;
  };
  generatedAt: string;
}

export interface Nep17Draft {
  name: string;
  symbol: string;
  decimals: string;
  initialSupply: string;
  owner: string;
  treasury: string;
  mintable: boolean;
  network: FactoryNetwork;
}

export interface Nep11Draft {
  collectionName: string;
  symbol: string;
  maxSupply: string;
  royaltyBps: string;
  baseUri: string;
  owner: string;
  transferable: boolean;
  network: FactoryNetwork;
}

export interface MiniAppDraft {
  appId: string;
  appName: string;
  templateKind: "reward-vault" | "ticket-pass" | "certificate" | "oracle-console";
  admin: string;
  network: FactoryNetwork;
  needsOracle: boolean;
  needsOneGate: boolean;
}

export interface FactoryDraft {
  kind: FactoryKind;
  nep17: Nep17Draft;
  nep11: Nep11Draft;
  miniapp: MiniAppDraft;
}

const DEFAULT_FACTORY_APP_ID = "miniapp-asset-factory";
const NEO_ADDRESS = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;
const HASH160 = /^0x[a-fA-F0-9]{40}$/;
const SYMBOL = /^[A-Z][A-Z0-9]{1,11}$/;
const MINIAPP_ID = /^miniapp-[a-z0-9][a-z0-9-]{2,62}$/;

function readBuildEnv(key: string): string {
  const meta = import.meta as unknown as { env?: Record<string, unknown> };
  return String(meta.env?.[key] ?? "").trim();
}

const FACTORY_CONTRACTS: Record<FactoryNetwork, string> = {
  "neo-n3-mainnet": readBuildEnv("VITE_NEO_FACTORY_MAINNET_CONTRACT"),
  "neo-n3-testnet": readBuildEnv("VITE_NEO_FACTORY_TESTNET_CONTRACT"),
};

const DOMAIN_FACTORY_CONTRACTS: Record<FactoryKind, Record<FactoryNetwork, string>> = {
  nep17: {
    "neo-n3-mainnet": readBuildEnv("VITE_ASSET_FACTORY_MAINNET_CONTRACT"),
    "neo-n3-testnet": readBuildEnv("VITE_ASSET_FACTORY_TESTNET_CONTRACT"),
  },
  nep11: {
    "neo-n3-mainnet": readBuildEnv("VITE_NFT_FACTORY_MAINNET_CONTRACT"),
    "neo-n3-testnet": readBuildEnv("VITE_NFT_FACTORY_TESTNET_CONTRACT"),
  },
  miniapp: {
    "neo-n3-mainnet": readBuildEnv("VITE_MINIAPP_FACTORY_MAINNET_CONTRACT"),
    "neo-n3-testnet": readBuildEnv("VITE_MINIAPP_FACTORY_TESTNET_CONTRACT"),
  },
};

export const FACTORY_APP_IDS: Record<FactoryKind, string> = {
  nep17: "miniapp-asset-factory",
  nep11: "miniapp-nft-factory",
  miniapp: "miniapp-miniapp-factory",
};

interface FactoryTemplateDefinition {
  id: string;
  version: string;
  standard: string;
  deployOperation: "deployFromTemplate" | "createMiniAppFromTemplate";
  artifact: FactoryPlan["templateArtifact"];
}

const TEMPLATE_REGISTRY = {
  nep17: {
    id: "tpl.nep17.asset.v1",
    version: "1.0.0",
    standard: "NEP-17",
    deployOperation: "deployFromTemplate",
    artifact: {
      status: "preloaded-on-chain",
      nefHash: "0x7fd0a6dd1aef5521a8c86d06bca2fc13c5d7e7fa32a9ae47dd9b1e51abef1701",
      manifestHash: "0x58d47f4f719f0a6726c63fd0b1540e8bd7cb846a92467a3700ec0f76f6719ad2",
      configSchemaHash: "0x9f6b1a29b79b6e8e30600f7f1d9728b7d7c920a48f6d6274557a63116a68253f",
    },
  },
  nep11: {
    id: "tpl.nep11.collection.v1",
    version: "1.0.0",
    standard: "NEP-11",
    deployOperation: "deployFromTemplate",
    artifact: {
      status: "preloaded-on-chain",
      nefHash: "0xf3a4a2e81b725c4d7a53fda7de4ff3ef2328e514edce6e868b6b978561c4e4d0",
      manifestHash: "0xad4cc0d3c5a45efddbbd0ed60bb9f9dc6dfc0917df77426a06605da4d1115c67",
      configSchemaHash: "0x36f9e031c5a6623cc1f53f7c2f5e945a174a4ac5bbcc6d09979faf222f353917",
    },
  },
  miniapp: {
    "reward-vault": {
      id: "tpl.miniapp.reward-vault.v1",
      version: "1.0.0",
      standard: "Neo MiniApp",
      deployOperation: "createMiniAppFromTemplate",
      artifact: {
        status: "preloaded-on-chain",
        nefHash: "0x17a7d94bd969018f7644412e3ff5f1c7982fbd7acc2be2d79380bd1042f1762d",
        manifestHash: "0xf717dbde778da5c89e7f2ef620b75e58454f4170fe2a5f7c36e545858162c624",
        configSchemaHash: "0x23dc67244fcba5d1642ed3e5e95e510f9f514621aa3522bd55e5f9e66992c25a",
      },
    },
    "ticket-pass": {
      id: "tpl.miniapp.ticket-pass.v1",
      version: "1.0.0",
      standard: "Neo MiniApp",
      deployOperation: "createMiniAppFromTemplate",
      artifact: {
        status: "preloaded-on-chain",
        nefHash: "0x79bfaa31d82cd3673c7dbcb535a4fd5bd3517e1c352877a893570821ce9c2e11",
        manifestHash: "0xb783e18c90120e07ea6709c7822d22f4f80c5c40a8e4ea0e27424f6ae9e27310",
        configSchemaHash: "0x6d541c11bb7241a9508617720a8ad49df972cd6293455fdf57f314ef0abb8e47",
      },
    },
    certificate: {
      id: "tpl.miniapp.certificate.v1",
      version: "1.0.0",
      standard: "Neo MiniApp",
      deployOperation: "createMiniAppFromTemplate",
      artifact: {
        status: "preloaded-on-chain",
        nefHash: "0xa8e1becd9e8ff599fe35a721820bf8bbbfedb99092f2747597dc637c27c8b080",
        manifestHash: "0xf091bc1d11454a7c9463fdcbbeb48dccd7ddf2b2d2acfd33cc51322a91765d21",
        configSchemaHash: "0xcfe61ba9e4993186e9b5859eac6a10658626f9d14f77622c4572872a547b33b0",
      },
    },
    "oracle-console": {
      id: "tpl.miniapp.oracle-console.v1",
      version: "1.0.0",
      standard: "Neo MiniApp",
      deployOperation: "createMiniAppFromTemplate",
      artifact: {
        status: "preloaded-on-chain",
        nefHash: "0x28f46b78a401fe283fa4e489aa9e9b6d54ac89f6f9b8baf40432e0e2a5d1f0da",
        manifestHash: "0xb6be4c6ca95a219b14e38d3957f378e1223ccca838e54032792e9ed31c68d40f",
        configSchemaHash: "0x5b3961f1a19811f610d2c31af61cf8c63f434dcc857eb4f6f80a3cda37649fb3",
      },
    },
  },
} satisfies {
  nep17: FactoryTemplateDefinition;
  nep11: FactoryTemplateDefinition;
  miniapp: Record<MiniAppDraft["templateKind"], FactoryTemplateDefinition>;
};

export const DEFAULT_FACTORY_DRAFT: FactoryDraft = {
  kind: "nep17",
  nep17: {
    name: "R3E Credits",
    symbol: "R3E",
    decimals: "8",
    initialSupply: "1000000",
    owner: "",
    treasury: "",
    mintable: true,
    network: "neo-n3-testnet",
  },
  nep11: {
    collectionName: "Neo Builder Pass",
    symbol: "NBP",
    maxSupply: "5000",
    royaltyBps: "250",
    baseUri: "https://assets.neomini.app/nft/neo-builder-pass/",
    owner: "",
    transferable: true,
    network: "neo-n3-testnet",
  },
  miniapp: {
    appId: "miniapp-my-launch",
    appName: "My Launch",
    templateKind: "reward-vault",
    admin: "",
    network: "neo-n3-testnet",
    needsOracle: false,
    needsOneGate: true,
  },
};

function safeString(value: unknown, max = 256): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function normalizeNetwork(value: unknown): FactoryNetwork {
  const raw = safeString(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "neo-n3-mainnet";
  return "neo-n3-testnet";
}

function isNeoAccount(value: string): boolean {
  return NEO_ADDRESS.test(value) || HASH160.test(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestPayload(value: unknown): string {
  const canonical = stableJson(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= BigInt(canonical.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return `nf_${hash.toString(16).padStart(16, "0")}`;
}

function requiredText(value: string, minLength: number, maxLength: number): boolean {
  return value.length >= minLength && value.length <= maxLength;
}

function getFactoryContract(kind: FactoryKind, network: FactoryNetwork): string {
  return DOMAIN_FACTORY_CONTRACTS[kind]?.[network] || FACTORY_CONTRACTS[network] || "";
}

function parseInteger(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export function parseDecimalToUnits(value: string, decimals: number): bigint {
  const raw = safeString(value, 80);
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error("invalid decimal");
  }

  const [wholePart = "0", fractionPart = ""] = raw.split(".");
  if (fractionPart.length > decimals) {
    throw new Error("precision exceeds decimals");
  }

  const factor = 10n ** BigInt(decimals);
  const whole = BigInt(wholePart);
  const fraction = BigInt((fractionPart + "0".repeat(decimals)).slice(0, decimals) || "0");
  return whole * factor + fraction;
}

function makeSteps(errors: string[], deployTitle: string): FactoryStep[] {
  const blocked = errors.length > 0;
  return [
    {
      key: "validate",
      title: "Validate inputs",
      detail: blocked ? "Fix blocking errors before deployment." : "Names, symbols, owner, and parameter bounds are valid.",
      status: blocked ? "blocked" : "ready",
    },
    {
      key: "template",
      title: "Select on-chain template",
      detail: blocked
        ? "Template metadata is deterministic, but the factory contract must be configured before execution."
        : "Use the preloaded NEF and manifest stored by the Factory contract.",
      status: blocked ? "blocked" : "ready",
    },
    {
      key: "deploy",
      title: deployTitle,
      detail: "Submit only template ID and initialization parameters to the Factory contract.",
      status: blocked ? "blocked" : "manual",
    },
    {
      key: "bind",
      title: "Bind domain and catalog metadata",
      detail: "Record contract hash, NeoNS domain, network, and OneGate launch URL in the shared registry.",
      status: blocked ? "blocked" : "manual",
    },
  ];
}

function planEnvelope(
  kind: FactoryKind,
  title: string,
  network: FactoryNetwork,
  template: FactoryTemplateDefinition,
  operation: string,
  errors: string[],
  warnings: string[],
  initParams: Record<string, unknown>,
  deployTitle: string,
  launcherAppId: string,
): FactoryPlan {
  const factoryContract = getFactoryContract(kind, network);
  const blockingErrors = [...errors];
  if (!factoryContract) blockingErrors.push("factory_contract_not_configured");
  else if (!HASH160.test(factoryContract)) blockingErrors.push("factory_contract_invalid");
  const payload = {
    standard: template.standard,
    templateId: template.id,
    templateVersion: template.version,
    initParams,
  };
  const digest = digestPayload({
    kind,
    network,
    templateId: template.id,
    templateVersion: template.version,
    artifact: template.artifact,
    operation,
    payload,
  });
  const packageId = `${template.id.replace(/\./g, "-")}-${digest.slice(-10)}`;
  const initParamsJson = JSON.stringify(initParams);
  const oneGateParams = {
    operation,
    template: kind,
    templateId: template.id,
    network: network === "neo-n3-mainnet" ? "mainnet" : "testnet",
    packageId,
    digest,
  };

  return {
    kind,
    title,
    network,
    templateRef: template.id,
    templateId: template.id,
    templateVersion: template.version,
    templateArtifact: template.artifact,
    operation,
    deploymentCall: {
      scriptHash: factoryContract,
      operation: template.deployOperation,
      args: [
        { type: "String", value: template.id },
        { type: "String", value: packageId },
        { type: "String", value: digest },
        { type: "String", value: initParamsJson },
      ],
    },
    packageId,
    digest,
    publishable: blockingErrors.length === 0,
    blockingErrors,
    warnings,
    payload,
    steps: makeSteps(blockingErrors, deployTitle),
    oneGate: {
      url: buildOneGateLaunchUrl(launcherAppId, oneGateParams),
      params: oneGateParams,
    },
    generatedAt: "deterministic",
  };
}

function buildNep17Plan(input: Record<string, unknown>, launcherAppId: string): FactoryPlan {
  const name = safeString(input.name, 64);
  const symbol = safeString(input.symbol, 16).toUpperCase();
  const decimalsRaw = safeString(input.decimals || "8", 4);
  const initialSupply = safeString(input.initialSupply, 80);
  const owner = safeString(input.owner, 64);
  const treasury = safeString(input.treasury || owner, 64);
  const mintable = Boolean(input.mintable);
  const network = normalizeNetwork(input.network);
  const decimals = parseInteger(decimalsRaw, 0, 8);
  const errors: string[] = [];
  const warnings: string[] = [];
  let initialSupplyUnits = "";

  if (!requiredText(name, 3, 64)) errors.push("name_length");
  if (!SYMBOL.test(symbol)) errors.push("symbol_format");
  if (decimals === null) errors.push("decimals_range");
  if (!isNeoAccount(owner)) errors.push("owner_address");
  if (treasury && !isNeoAccount(treasury)) errors.push("treasury_address");

  try {
    if (decimals !== null) {
      const units = parseDecimalToUnits(initialSupply, decimals);
      if (units <= 0n) errors.push("initial_supply_positive");
      initialSupplyUnits = units.toString();
    }
  } catch (error) {
    errors.push(error instanceof Error && error.message.includes("precision")
      ? "initial_supply_precision"
      : "initial_supply_format");
  }

  if (network === "neo-n3-mainnet") {
    warnings.push("mainnet_review_required");
  }

  const initParams = {
    name,
    symbol,
    decimals: decimals ?? decimalsRaw,
    initialSupply,
    initialSupplyUnits,
    owner,
    treasury,
    mintable,
    transferPolicy: "standard-nep17",
  };

  return planEnvelope(
    "nep17",
    `${symbol || "NEP17"} asset`,
    network,
    TEMPLATE_REGISTRY.nep17,
    "prepareNEP17",
    errors,
    warnings,
    initParams,
    "Deploy NEP-17 from template",
    launcherAppId,
  );
}

function buildNep11Plan(input: Record<string, unknown>, launcherAppId: string): FactoryPlan {
  const collectionName = safeString(input.collectionName || input.name, 64);
  const symbol = safeString(input.symbol, 16).toUpperCase();
  const maxSupplyRaw = safeString(input.maxSupply || "0", 20);
  const royaltyBpsRaw = safeString(input.royaltyBps || "0", 8);
  const baseUri = safeString(input.baseUri, 256);
  const owner = safeString(input.owner, 64);
  const transferable = Boolean(input.transferable);
  const network = normalizeNetwork(input.network);
  const maxSupply = parseInteger(maxSupplyRaw, 1, 1_000_000);
  const royaltyBps = parseInteger(royaltyBpsRaw, 0, 1_000);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!requiredText(collectionName, 3, 64)) errors.push("collection_name_length");
  if (!SYMBOL.test(symbol)) errors.push("symbol_format");
  if (maxSupply === null) errors.push("max_supply_range");
  if (royaltyBps === null) errors.push("royalty_range");
  if (!/^https:\/\/[^ ]+\/$/.test(baseUri)) errors.push("base_uri_https_trailing_slash");
  if (!isNeoAccount(owner)) errors.push("owner_address");
  if (network === "neo-n3-mainnet") warnings.push("mainnet_review_required");

  const initParams = {
    collectionName,
    symbol,
    maxSupply: maxSupply ?? maxSupplyRaw,
    royaltyBps: royaltyBps ?? royaltyBpsRaw,
    baseUri,
    owner,
    transferPolicy: transferable ? "transferable" : "soulbound",
  };

  return planEnvelope(
    "nep11",
    `${symbol || "NEP11"} collection`,
    network,
    TEMPLATE_REGISTRY.nep11,
    "prepareNEP11",
    errors,
    warnings,
    initParams,
    "Deploy NEP-11 from template",
    launcherAppId,
  );
}

function buildMiniAppPlan(input: Record<string, unknown>, launcherAppId: string): FactoryPlan {
  const appId = safeString(input.appId, 80).toLowerCase();
  const appName = safeString(input.appName || input.name, 64);
  const templateKind = safeString(input.templateKind || "reward-vault", 40);
  const admin = safeString(input.admin || input.owner, 64);
  const network = normalizeNetwork(input.network);
  const needsOracle = Boolean(input.needsOracle);
  const needsOneGate = input.needsOneGate !== false;
  const errors: string[] = [];
  const warnings: string[] = ["catalog_registration_required"];
  const validTemplateKinds = ["reward-vault", "ticket-pass", "certificate", "oracle-console"] as const;
  const isValidTemplateKind = validTemplateKinds.includes(templateKind as MiniAppDraft["templateKind"]);
  const resolvedTemplateKind = isValidTemplateKind
    ? (templateKind as MiniAppDraft["templateKind"])
    : "reward-vault";
  const template = TEMPLATE_REGISTRY.miniapp[resolvedTemplateKind];

  if (!MINIAPP_ID.test(appId)) errors.push("app_id_format");
  if (!requiredText(appName, 3, 64)) errors.push("app_name_length");
  if (!isValidTemplateKind) errors.push("template_kind");
  if (!isNeoAccount(admin)) errors.push("admin_address");
  if (network === "neo-n3-mainnet") warnings.push("mainnet_review_required");

  const initParams = {
    appId,
    appName,
    templateKind: resolvedTemplateKind,
    admin,
    network,
    capabilities: {
      oneGate: needsOneGate,
      oracle: needsOracle,
      nep21: true,
    },
    catalogPatch: {
      id: appId,
      name: appName,
      default_network: network,
      permissions: needsOracle ? ["read:blockchain", "oracle:request"] : ["read:blockchain"],
      features: {
        stateless: true,
        deeplink: `neomainapp://${appId.replace(/^miniapp-/, "")}`,
      },
    },
  };

  return planEnvelope(
    "miniapp",
    appName || "MiniApp package",
    network,
    template,
    "prepareMiniApp",
    errors,
    warnings,
    initParams,
    "Create platform miniapp from template",
    launcherAppId,
  );
}

export function buildFactoryPlan(
  kind: FactoryKind,
  input: Record<string, unknown>,
  options: { appId?: string } = {},
): FactoryPlan {
  const appId = options.appId || FACTORY_APP_IDS[kind] || DEFAULT_FACTORY_APP_ID;
  if (kind === "nep17") return buildNep17Plan(input, appId);
  if (kind === "nep11") return buildNep11Plan(input, appId);
  return buildMiniAppPlan(input, appId);
}

function pickKind(context: MiniAppLaunchContext): FactoryKind {
  const template = safeString(context.params.template || context.operation).toLowerCase();
  if (template.includes("nep11")) return "nep11";
  if (template.includes("miniapp") || template.includes("app")) return "miniapp";
  return "nep17";
}

export function createFactoryDraftFromLaunchContext(
  context: MiniAppLaunchContext,
  forcedKind?: FactoryKind,
): FactoryDraft {
  const draft: FactoryDraft = structuredClone(DEFAULT_FACTORY_DRAFT);
  const params = context.params;
  const network = normalizeNetwork(context.network || params.network);
  const kind = forcedKind ?? pickKind(context);

  draft.kind = kind;
  draft.nep17.network = network;
  draft.nep11.network = network;
  draft.miniapp.network = network;

  if (params.name) {
    draft.nep17.name = safeString(params.name, 64);
    draft.nep11.collectionName = safeString(params.name, 64);
    draft.miniapp.appName = safeString(params.name, 64);
  }
  if (params.symbol) {
    draft.nep17.symbol = safeString(params.symbol, 16).toUpperCase();
    draft.nep11.symbol = safeString(params.symbol, 16).toUpperCase();
  }
  if (params.owner) {
    draft.nep17.owner = safeString(params.owner, 64);
    draft.nep17.treasury = safeString(params.owner, 64);
    draft.nep11.owner = safeString(params.owner, 64);
    draft.miniapp.admin = safeString(params.owner, 64);
  }
  if (params.appId) draft.miniapp.appId = safeString(params.appId, 80).toLowerCase();
  if (params.initialSupply) draft.nep17.initialSupply = safeString(params.initialSupply, 80);
  if (params.decimals) draft.nep17.decimals = safeString(params.decimals, 4);
  if (params.maxSupply) draft.nep11.maxSupply = safeString(params.maxSupply, 20);
  if (params.baseUri) draft.nep11.baseUri = safeString(params.baseUri, 256);
  if (params.templateKind) {
    draft.miniapp.templateKind = safeString(params.templateKind, 40) as MiniAppDraft["templateKind"];
  }

  return draft;
}
