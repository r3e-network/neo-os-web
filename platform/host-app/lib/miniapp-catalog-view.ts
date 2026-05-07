import type { MiniAppInfo } from "@/components/types";

type Dict = Record<string, unknown>;

type CatalogNetwork = "neo-n3-mainnet" | "neo-n3-testnet";

export type MiniAppCatalogTone =
  | "live"
  | "pending"
  | "tool"
  | "unsupported";

export type MiniAppCatalogAvailability = {
  label: string;
  tone: MiniAppCatalogTone;
  supported: boolean;
};

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeCatalogNetwork(value: unknown): CatalogNetwork | null {
  const raw = asString(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "neo-n3-mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "neo-n3-testnet";
  return null;
}

function getSupportedNetworks(app: MiniAppInfo): CatalogNetwork[] {
  const manifest = asObject(app.manifest);
  const raw = Array.isArray(manifest.supported_networks)
    ? manifest.supported_networks
    : [];
  return raw
    .map(normalizeCatalogNetwork)
    .filter((network): network is CatalogNetwork => Boolean(network));
}

function platformRuntimeSupportsNetwork(app: MiniAppInfo, network: CatalogNetwork): boolean {
  const runtime = asObject(asObject(app.manifest).runtime);
  if (asString(runtime.mode) !== "platform") return false;
  const modules = Array.isArray(runtime.modules) ? runtime.modules : [];
  return modules.some((module) => {
    const networks = asObject(asObject(module).networks);
    const binding = asObject(networks[network]);
    return Boolean(asString(binding.contract_hash));
  });
}

function miniAppSupportsNetwork(app: MiniAppInfo, network: CatalogNetwork | null): boolean {
  if (!network) return true;

  const supportedNetworks = getSupportedNetworks(app);
  if (supportedNetworks.length > 0 && !supportedNetworks.includes(network)) return false;
  if (platformRuntimeSupportsNetwork(app, network)) return true;

  const manifest = asObject(app.manifest);
  const contracts = asObject(manifest.contracts);
  const manifestHasAnyContract = Object.values(contracts).some((value) => Boolean(asString(value)));
  const topLevelContractHash = asString(app.contract_hash);
  if (!manifestHasAnyContract) return Boolean(topLevelContractHash) || supportedNetworks.length > 0 || !manifest.supported_networks;

  return Boolean(getNetworkContractHash(app, network));
}

function getNetworkContractHash(
  app: MiniAppInfo,
  network: CatalogNetwork | null,
): string {
  const manifest = asObject(app.manifest);
  const contracts = asObject(manifest.contracts);
  const topLevelContractHash = asString(app.contract_hash);
  if (!network) {
    return topLevelContractHash || Object.values(contracts).map(asString).find(Boolean) || "";
  }

  const shortKey = network === "neo-n3-mainnet" ? "mainnet" : "testnet";
  const networkHash = asString(contracts[network] ?? contracts[shortKey]);
  if (networkHash) return networkHash;
  if (Object.values(contracts).some((value) => Boolean(asString(value)))) return "";
  return topLevelContractHash;
}

function getUnsupportedLabel(app: MiniAppInfo): string {
  const supportedNetworks = getSupportedNetworks(app);
  if (supportedNetworks.length === 1) {
    return supportedNetworks[0] === "neo-n3-testnet" ? "Testnet only" : "Mainnet only";
  }
  if (supportedNetworks.length > 1) return "Network unavailable";
  return "Tool";
}

export function getMiniAppCatalogAvailability(
  app: MiniAppInfo,
  targetNetwork: unknown,
): MiniAppCatalogAvailability {
  const network = normalizeCatalogNetwork(targetNetwork);
  const supported = miniAppSupportsNetwork(app, network);
  if (!supported) {
    return {
      label: getUnsupportedLabel(app),
      tone: "unsupported",
      supported: false,
    };
  }

  if (app.status === "pending") {
    return { label: "Pending", tone: "pending", supported: true };
  }

  const live = Boolean(getNetworkContractHash(app, network));
  if (live) return { label: "Live", tone: "live", supported: true };
  return { label: "Tool", tone: "tool", supported: true };
}

export function compactMiniAppManifestForCatalog(
  value: unknown,
): Record<string, unknown> | null {
  const manifest = asObject(value);
  if (Object.keys(manifest).length === 0) return null;

  const compact: Record<string, unknown> = {};
  for (const key of ["supported_networks", "contracts", "runtime", "deployment"] as const) {
    if (manifest[key] !== undefined && manifest[key] !== null) {
      compact[key] = manifest[key];
    }
  }

  return Object.keys(compact).length > 0
    ? JSON.parse(JSON.stringify(compact)) as Record<string, unknown>
    : null;
}
