import type { MiniAppInfo, OperationEntry, OperationParam } from "@/components/types";

export type MiniAppRuntimeNetwork = "neo-n3-mainnet" | "neo-n3-testnet";

type Dict = Record<string, unknown>;

export type PlatformRuntimeNetworkBinding = {
  contract_hash?: string;
  registered?: boolean;
  domain?: string;
};

export type PlatformRuntimeModule = {
  binding: string;
  platform: string;
  appId: string;
  moduleType?: string | number;
  networks: Record<string, PlatformRuntimeNetworkBinding>;
  operations?: Record<string, unknown>;
};

export type ResolvedPlatformRuntime = {
  mode: "platform";
  network: MiniAppRuntimeNetwork;
  appId: string;
  binding: string | null;
  platform: string | null;
  moduleType: string | number | null;
  contractHash: string | null;
  registered: boolean;
  writesEnabled: boolean;
  disabledReason: string | null;
  module: PlatformRuntimeModule | null;
};

export type ResolvedDedicatedRuntime = {
  mode: "dedicated";
  network: MiniAppRuntimeNetwork;
  contractHash: string | null;
  writesEnabled: boolean;
  disabledReason: string | null;
};

export type ResolvedMiniAppRuntime = ResolvedPlatformRuntime | ResolvedDedicatedRuntime;

export type MiniAppContractDomainSource =
  | "runtime"
  | "manifest"
  | "configured"
  | "expected";

export type ResolvedMiniAppContractDomain = {
  network: MiniAppRuntimeNetwork;
  contractHash: string;
  domain: string;
  source: MiniAppContractDomainSource;
};

const MAINNET_CONTRACT_DOMAINS_BY_APP_ID: Record<string, string> = {
  "miniapp-last-survivor": "lastsurvivor.miniapp.neo",
  "miniapp-fogplay": "fogplay.miniapp.neo",
  "miniapp-gasbox": "gasbox.miniapp.neo",
  "miniapp-redenvelope": "redenvelope.miniapp.neo",
  "miniapp-gas-lucky-pool": "gasluckypool.miniapp.neo",
  "miniapp-dailycheckin": "dailycheckin.miniapp.neo",
  "miniapp-self-loan": "selfloan.miniapp.neo",
  "miniapp-neo-pay": "neopay.miniapp.neo",
  "miniapp-profitanchor": "profitanchor.miniapp.neo",
  "miniapp-trustanchor": "trustanchor.miniapp.neo",
  "miniapp-profitanchor-admin": "profitanchor.miniapp.neo",
  "miniapp-trustanchor-admin": "trustanchor.miniapp.neo",
};

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asNetwork(value: unknown): MiniAppRuntimeNetwork {
  const raw = asString(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "neo-n3-mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "neo-n3-testnet";
  return "neo-n3-testnet";
}

function getNetworkKeys(network: MiniAppRuntimeNetwork): [MiniAppRuntimeNetwork, "mainnet" | "testnet"] {
  return [network, network === "neo-n3-mainnet" ? "mainnet" : "testnet"];
}

function getNetworkValue(source: Dict, network: MiniAppRuntimeNetwork): unknown {
  const [networkKey, shortKey] = getNetworkKeys(network);
  return source[networkKey] ?? source[shortKey];
}

function getContractHashFromEntry(value: unknown): string {
  const entry = asObject(value);
  return Object.keys(entry).length > 0
    ? asString(entry.contract_hash ?? entry.hash ?? entry.address)
    : asString(value);
}

function getContractHashForNetwork(contracts: Dict, network: MiniAppRuntimeNetwork): string {
  return getContractHashFromEntry(getNetworkValue(contracts, network));
}

function getDomainFromObject(value: unknown): string {
  const obj = asObject(value);
  return asString(
    obj.domain
      ?? obj.contract_domain
      ?? obj.contractDomain
      ?? obj.nns
      ?? obj.neo_ns
      ?? obj.neoNS,
  );
}

function getDomainFromNetworkDomainMap(
  domains: Dict,
  network: MiniAppRuntimeNetwork,
  contractHash?: string | null,
): string {
  const networkValue = getNetworkValue(domains, network);
  const networkDomain =
    getDomainFromObject(networkValue) ||
    (typeof networkValue === "string" ? asString(networkValue) : "");
  if (networkDomain) return networkDomain;

  const hash = asString(contractHash).toLowerCase();
  if (!hash) return "";
  const hashValue =
    domains[contractHash as string]
      ?? domains[hash]
      ?? domains[hash.replace(/^0x/, "")];
  return getDomainFromObject(hashValue) || (typeof hashValue === "string" ? asString(hashValue) : "");
}

function getDomainFromNetworkContractMap(contracts: Dict, network: MiniAppRuntimeNetwork): string {
  return getDomainFromObject(getNetworkValue(contracts, network));
}

function resolveManifestContractDomain(
  app: MiniAppInfo,
  network: MiniAppRuntimeNetwork,
  contractHash: string,
): string {
  const manifest = asObject(app.manifest);
  const contract = asObject(manifest.contract);
  const manifestDomains = asObject(manifest.domains);
  const contractDomainMaps = [
    asObject(manifest.contract_domains),
    asObject(manifest.contractDomains),
    asObject(contract.domains),
    asObject(contract.contract_domains),
    asObject(contract.contractDomains),
    asObject(manifestDomains.contracts),
    asObject(manifestDomains.contract_domains),
    asObject(manifestDomains.contractDomains),
  ];

  for (const domains of contractDomainMaps) {
    const domain = getDomainFromNetworkDomainMap(domains, network, contractHash);
    if (domain) return domain;
  }

  const domainFromContractEntry = getDomainFromNetworkContractMap(
    asObject(manifest.contracts),
    network,
  );
  if (domainFromContractEntry) return domainFromContractEntry;

  if (network === "neo-n3-mainnet") {
    return getDomainFromObject(contract);
  }

  return "";
}

function buildExpectedMainnetContractDomain(appId: string): string {
  const slug = asString(appId)
    .toLowerCase()
    .replace(/^miniapp[-_.]?/, "")
    .replace(/[^a-z0-9]/g, "");
  return slug ? `${slug}.miniapp.neo` : "";
}

function normalizePlatformModule(value: unknown): PlatformRuntimeModule | null {
  const obj = asObject(value);
  const binding = asString(obj.binding);
  const platform = asString(obj.platform);
  const appId = asString(obj.appId ?? obj.app_id);
  const networks = asObject(obj.networks);
  if (!binding || !platform || !appId || Object.keys(networks).length === 0) return null;

  const normalizedNetworks: Record<string, PlatformRuntimeNetworkBinding> = {};
  for (const [key, rawBinding] of Object.entries(networks)) {
    const network = asNetwork(key);
    const bindingInfo = asObject(rawBinding);
    normalizedNetworks[network] = {
      contract_hash: asString(bindingInfo.contract_hash),
      registered: bindingInfo.registered === true,
      domain: getDomainFromObject(bindingInfo),
    };
  }

  return {
    binding,
    platform,
    appId,
    moduleType: typeof obj.moduleType === "number" || typeof obj.moduleType === "string" ? obj.moduleType : undefined,
    networks: normalizedNetworks,
    operations: asObject(obj.operations),
  };
}

export function getPlatformRuntimeModules(app: MiniAppInfo): PlatformRuntimeModule[] {
  const runtime = asObject(asObject(app.manifest).runtime);
  if (asString(runtime.mode) !== "platform") return [];
  const modules = Array.isArray(runtime.modules) ? runtime.modules : [];
  return modules.map(normalizePlatformModule).filter((module): module is PlatformRuntimeModule => Boolean(module));
}

function getFirstPlatformModuleForNetwork(
  modules: PlatformRuntimeModule[],
  network: MiniAppRuntimeNetwork,
): PlatformRuntimeModule | null {
  return modules.find((module) => Boolean(asString(module.networks[network]?.contract_hash)))
    || modules.find((module) => Boolean(module.networks[network]))
    || modules[0]
    || null;
}

export function resolveMiniAppRuntime(
  app: MiniAppInfo,
  networkValue?: unknown,
): ResolvedMiniAppRuntime {
  const network = asNetwork(networkValue);
  const platformModules = getPlatformRuntimeModules(app);
  if (platformModules.length > 0) {
    const module = getFirstPlatformModuleForNetwork(platformModules, network);
    const binding = module?.networks[network];
    const contractHash = asString(binding?.contract_hash);
    const registered = binding?.registered === true;
    const writesEnabled = Boolean(contractHash) && registered;
    return {
      mode: "platform",
      network,
      appId: module?.appId ?? app.app_id,
      binding: module?.binding ?? null,
      platform: module?.platform ?? null,
      moduleType: module?.moduleType ?? null,
      contractHash: contractHash || null,
      registered,
      writesEnabled,
      disabledReason: writesEnabled
        ? null
        : !contractHash
          ? "platform contract is not configured for this network"
          : "miniapp is not registered in the platform contract for this network",
      module,
    };
  }

  const manifest = asObject(app.manifest);
  const manifestHash = getContractHashForNetwork(asObject(manifest.contracts), network);
  const contractHash = manifestHash || asString(app.contract_hash);
  return {
    mode: "dedicated",
    network,
    contractHash: contractHash || null,
    writesEnabled: Boolean(contractHash),
    disabledReason: contractHash ? null : "contract is not configured for this network",
  };
}

export function resolveMiniAppContractDomain(
  app: MiniAppInfo,
  networkValue?: unknown,
  runtimeValue?: ResolvedMiniAppRuntime | null,
): ResolvedMiniAppContractDomain | null {
  const network = asNetwork(networkValue);
  const runtime = runtimeValue ?? resolveMiniAppRuntime(app, network);
  const manifest = asObject(app.manifest);
  const contractHash = asString(
    runtime.mode === "platform"
      ? runtime.contractHash
      : getContractHashForNetwork(asObject(manifest.contracts), network) || app.contract_hash,
  );
  if (!contractHash) return null;

  const runtimeDomain =
    runtime.mode === "platform"
      ? asString(runtime.module?.networks[network]?.domain)
      : "";
  if (runtimeDomain) {
    return {
      network,
      contractHash,
      domain: runtimeDomain,
      source: "runtime",
    };
  }

  const manifestDomain = resolveManifestContractDomain(app, network, contractHash);
  if (manifestDomain) {
    return {
      network,
      contractHash,
      domain: manifestDomain,
      source: "manifest",
    };
  }

  if (network !== "neo-n3-mainnet") return null;

  const configuredDomain = MAINNET_CONTRACT_DOMAINS_BY_APP_ID[app.app_id];
  if (configuredDomain) {
    return {
      network,
      contractHash,
      domain: configuredDomain,
      source: "configured",
    };
  }

  const expectedDomain = buildExpectedMainnetContractDomain(app.app_id);
  return expectedDomain
    ? {
        network,
        contractHash,
        domain: expectedDomain,
        source: "expected",
      }
    : null;
}

export function supportsRuntimeNetwork(app: MiniAppInfo, networkValue: unknown): boolean {
  const network = asNetwork(networkValue);
  return getPlatformRuntimeModules(app).some((module) => Boolean(asString(module.networks[network]?.contract_hash)));
}

export function injectRuntimeAppIdParam(
  operation: OperationEntry,
  runtime: ResolvedMiniAppRuntime,
): OperationEntry {
  if (runtime.mode !== "platform") return operation;
  const params = operation.params ?? [];
  const appIdParam: OperationParam = {
    name: "appId",
    type: "string",
    default_value: runtime.appId,
    hidden: true,
    required: true,
  };
  const nextParams = params.some((param) => param.name === "appId")
    ? params.map((param) => param.name === "appId" ? { ...appIdParam, ...param, hidden: true } : param)
    : [appIdParam, ...params];
  return { ...operation, params: nextParams };
}
