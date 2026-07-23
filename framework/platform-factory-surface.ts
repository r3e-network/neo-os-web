import { FrameworkCapabilityError } from "./aa";
import { WRITE_PRIMARY, guardedWrite } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import { parseBigInt, parseBool } from "./utils/parsers";

const HASH160_RE = /^0x[0-9a-fA-F]{40}$/;

export type FrameworkPlatformFactoryNetwork = "neo-n3-mainnet" | "neo-n3-testnet";

export interface FrameworkPlatformFactoryConfig {
  hashes: Partial<Record<FrameworkPlatformFactoryNetwork, string>>;
}

export interface FrameworkPlatformFactoryTx {
  txid: string;
  success?: boolean;
  event?: unknown;
}

export interface FrameworkPlatformFactoryInvokeOptions {
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onTransactionSent?: (txid: string) => void;
}

export interface FrameworkPlatformFactoryCall {
  operation: string;
  args: Array<{ type: string; value: unknown }>;
}

export interface PlatformFactorySurfaceChain {
  read(
    operation: string,
    args?: Array<{ type: string; value: unknown }>,
    options?: unknown,
  ): Promise<unknown>;
  invoke(
    operation: string,
    args: Array<{ type: string; value: unknown }>,
    options?: FrameworkPlatformFactoryInvokeOptions & { scriptHash?: string },
  ): Promise<FrameworkPlatformFactoryTx>;
}

export interface PlatformFactorySurfaceDeps {
  chain: PlatformFactorySurfaceChain;
  guards: FrameworkGuardDeps;
  config?: FrameworkPlatformFactoryConfig;
}

export interface FrameworkPlatformFactorySurface {
  readonly available: boolean;
  availableOn(network: FrameworkPlatformFactoryNetwork): boolean;
  getTemplate(network: FrameworkPlatformFactoryNetwork, templateId: string): Promise<unknown>;
  templateExists(network: FrameworkPlatformFactoryNetwork, templateId: string): Promise<boolean>;
  templateCount(network: FrameworkPlatformFactoryNetwork): Promise<bigint>;
  getTemplateIdByIndex(network: FrameworkPlatformFactoryNetwork, index: string | number | bigint): Promise<unknown>;
  deployFromTemplate(network: FrameworkPlatformFactoryNetwork, input: { templateId: string; packageId: string; digest: string; initParams: string; options?: FrameworkPlatformFactoryInvokeOptions }): Promise<FrameworkPlatformFactoryTx>;
  createMiniAppFromTemplate(network: FrameworkPlatformFactoryNetwork, input: { templateId: string; packageId: string; digest: string; initParams: string; options?: FrameworkPlatformFactoryInvokeOptions }): Promise<FrameworkPlatformFactoryTx>;
  deployArtifactFromTemplate(network: FrameworkPlatformFactoryNetwork, input: { templateId: string; packageId: string; digest: string; initParams: string; nef: string; manifest: string; options?: FrameworkPlatformFactoryInvokeOptions }): Promise<FrameworkPlatformFactoryTx>;
  executeDeploymentCall(network: FrameworkPlatformFactoryNetwork, call: FrameworkPlatformFactoryCall, options?: FrameworkPlatformFactoryInvokeOptions): Promise<FrameworkPlatformFactoryTx>;
  getDeployment(network: FrameworkPlatformFactoryNetwork, packageId: string): Promise<unknown>;
  getMiniApp(network: FrameworkPlatformFactoryNetwork, packageId: string): Promise<unknown>;
  deploymentCount(network: FrameworkPlatformFactoryNetwork): Promise<bigint>;
  miniAppCount(network: FrameworkPlatformFactoryNetwork): Promise<bigint>;
  getDeploymentIdByIndex(network: FrameworkPlatformFactoryNetwork, index: string | number | bigint): Promise<unknown>;
  getMiniAppIdByIndex(network: FrameworkPlatformFactoryNetwork, index: string | number | bigint): Promise<unknown>;
}

function requiredString(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function nonNegative(value: string | number | bigint, label: string): string {
  const normalized = parseBigInt(value);
  if (normalized < 0n) throw new Error(`${label} must be a non-negative integer`);
  return normalized.toString();
}

function callValues(call: FrameworkPlatformFactoryCall, count: number): string[] {
  if (!Array.isArray(call.args) || call.args.length !== count) {
    throw new Error(`${call.operation} requires exactly ${count} arguments`);
  }
  return call.args.map((arg, index) => requiredString(arg?.value, `${call.operation}.args[${index}]`));
}

export function createPlatformFactorySurface(
  deps: PlatformFactorySurfaceDeps,
): FrameworkPlatformFactorySurface {
  const config = deps.config;
  const configuredHashes = Object.values(config?.hashes ?? {}).filter((value) => String(value ?? "").trim());
  const valid = configuredHashes.length > 0 && configuredHashes.every((value) => HASH160_RE.test(String(value).trim()));
  const factoryHash = (network: FrameworkPlatformFactoryNetwork): string => {
    if (!config) {
      throw new FrameworkCapabilityError(
        "platformFactory",
        "MiniAppFactory is not configured on this host",
      );
    }
    const value = String(config.hashes?.[network] ?? "").trim();
    if (!HASH160_RE.test(value)) {
      throw new FrameworkCapabilityError(
        "platformFactory",
        `MiniAppFactory is not configured for ${network}`,
      );
    }
    return value.toLowerCase();
  };
  const stringArg = (value: unknown, label: string) => ({ type: "String", value: requiredString(value, label) });
  const indexArg = (value: string | number | bigint) => ({ type: "Integer", value: nonNegative(value, "index") });
  const read = (
    network: FrameworkPlatformFactoryNetwork,
    operation: string,
    args: Array<{ type: string; value: unknown }> = [],
  ) => deps.chain.read(operation, args, { scriptHash: factoryHash(network) });
  const invoke = (
    network: FrameworkPlatformFactoryNetwork,
    operation: string,
    args: Array<{ type: string; value: unknown }>,
    options?: FrameworkPlatformFactoryInvokeOptions,
  ) => deps.chain.invoke(operation, args, { ...(options ?? {}), scriptHash: factoryHash(network) });
  const write = <A extends unknown[]>(run: (...args: A) => Promise<FrameworkPlatformFactoryTx>) =>
    guardedWrite(deps.guards, WRITE_PRIMARY, run);
  const fourArgs = (input: { templateId: string; packageId: string; digest: string; initParams: string }) => [
    stringArg(input.templateId, "templateId"),
    stringArg(input.packageId, "packageId"),
    stringArg(input.digest, "digest"),
    stringArg(input.initParams, "initParams"),
  ];
  const deployFromTemplate = write(async (
    network: FrameworkPlatformFactoryNetwork,
    input: { templateId: string; packageId: string; digest: string; initParams: string; options?: FrameworkPlatformFactoryInvokeOptions },
  ) => invoke(network, "deployFromTemplate", fourArgs(input), input.options));
  const createMiniAppFromTemplate = write(async (
    network: FrameworkPlatformFactoryNetwork,
    input: { templateId: string; packageId: string; digest: string; initParams: string; options?: FrameworkPlatformFactoryInvokeOptions },
  ) => invoke(network, "createMiniAppFromTemplate", fourArgs(input), input.options));
  const deployArtifactFromTemplate = write(async (
    network: FrameworkPlatformFactoryNetwork,
    input: { templateId: string; packageId: string; digest: string; initParams: string; nef: string; manifest: string; options?: FrameworkPlatformFactoryInvokeOptions },
  ) => invoke(network, "deployArtifactFromTemplate", [
    ...fourArgs(input),
    { type: "ByteArray", value: requiredString(input.nef, "nef") },
    stringArg(input.manifest, "manifest"),
  ], input.options));

  return {
    get available() {
      return valid;
    },
    availableOn: (network) => Boolean(config && HASH160_RE.test(String(config.hashes?.[network] ?? "").trim())),
    getTemplate: async (network, templateId) => read(network, "getTemplate", [stringArg(templateId, "templateId")]),
    templateExists: async (network, templateId) => parseBool(await read(network, "templateExists", [stringArg(templateId, "templateId")])),
    templateCount: async (network) => parseBigInt(await read(network, "templateCount")),
    getTemplateIdByIndex: async (network, index) => read(network, "getTemplateIdByIndex", [indexArg(index)]),
    deployFromTemplate,
    createMiniAppFromTemplate,
    deployArtifactFromTemplate,
    executeDeploymentCall: async (network, call, options) => {
      if (call.operation === "deployFromTemplate") {
        const values = callValues(call, 4);
        return deployFromTemplate(network, {
          templateId: values[0]!, packageId: values[1]!, digest: values[2]!, initParams: values[3]!, options,
        });
      }
      if (call.operation === "createMiniAppFromTemplate") {
        const values = callValues(call, 4);
        return createMiniAppFromTemplate(network, {
          templateId: values[0]!, packageId: values[1]!, digest: values[2]!, initParams: values[3]!, options,
        });
      }
      if (call.operation === "deployArtifactFromTemplate") {
        const values = callValues(call, 6);
        return deployArtifactFromTemplate(network, {
          templateId: values[0]!, packageId: values[1]!, digest: values[2]!, initParams: values[3]!,
          nef: values[4]!, manifest: values[5]!, options,
        });
      }
      throw new Error(`Unsupported factory deployment operation: ${String(call.operation)}`);
    },
    getDeployment: async (network, packageId) => read(network, "getDeployment", [stringArg(packageId, "packageId")]),
    getMiniApp: async (network, packageId) => read(network, "getMiniApp", [stringArg(packageId, "packageId")]),
    deploymentCount: async (network) => parseBigInt(await read(network, "deploymentCount")),
    miniAppCount: async (network) => parseBigInt(await read(network, "miniAppCount")),
    getDeploymentIdByIndex: async (network, index) => read(network, "getDeploymentIdByIndex", [indexArg(index)]),
    getMiniAppIdByIndex: async (network, index) => read(network, "getMiniAppIdByIndex", [indexArg(index)]),
  };
}
