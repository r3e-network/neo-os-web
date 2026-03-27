import type { MiniAppInfo } from "@/components/types";
import { invokeRead, type Network, type StackItem } from "./rpc-client";

type Dict = Record<string, unknown>;

const SHARED_RUNTIME_DEFAULTS = {
  testnet: {
    moduleRegistry: process.env.CONTRACT_MODULEREGISTRY_HASH || "0x7666a46644dca58e8c3b308b34e83db440e04991",
    recipeRegistry: process.env.CONTRACT_RECIPEREGISTRY_HASH || "0xe22bc8072f616974a64c0da1dfda845945d4215f",
    instanceRegistry:
      process.env.CONTRACT_MINIAPPINSTANCEREGISTRY_HASH || "0x5b9a6d1ca5fdbc95d4307990551682a3b7a1d5d6",
  },
  mainnet: {
    moduleRegistry: process.env.CONTRACT_MODULEREGISTRY_MAINNET_HASH || "",
    recipeRegistry: process.env.CONTRACT_RECIPEREGISTRY_MAINNET_HASH || "",
    instanceRegistry: process.env.CONTRACT_MINIAPPINSTANCEREGISTRY_MAINNET_HASH || "",
  },
} as const;

export type SharedModeModuleBinding = {
  binding: string;
  moduleId: string;
  version: string;
};

export type SharedModeModuleInfo = {
  binding: string;
  moduleId: string;
  version: string;
  contractHash: string | null;
  riskProfile: string | null;
  active: boolean;
  compatibilityMetadata: Dict | null;
};

export type SharedModeRecipeInfo = {
  recipeId: string;
  version: string;
  allowedRuntimeMode: string | null;
  routerTemplateId: string | null;
  active: boolean;
  moduleRefs: unknown[] | null;
  requiredFields: Dict | null;
  operationSchema: Dict | null;
  compatibilityMetadata: Dict | null;
};

export type SharedModeInstanceInfo = {
  instanceId: string;
  appId: string;
  recipeId: string;
  recipeVersion: string;
  runtimeMode: string;
  ownerHash: string | null;
  operatorHash: string | null;
  developerHash: string | null;
  routerContractHash: string | null;
  moduleBindings: Dict | null;
  configHash: string | null;
  frontendRef: string | null;
  status: number;
  upgradePending: boolean;
  updatedAt: string | null;
};

export type SharedModeRuntimeInfo = {
  network: Network;
  registries: {
    moduleRegistry: string;
    recipeRegistry: string;
    instanceRegistry: string;
  };
  instance: SharedModeInstanceInfo;
  recipe: SharedModeRecipeInfo | null;
  modules: SharedModeModuleInfo[];
};

export type SharedModeOperationArg = {
  source?: string;
  type?: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "Any";
  scale?: number;
  value?: string | number | boolean;
};

export type SharedModeOperationRecipe = {
  operation: string;
  binding: string;
  method: string;
  args: SharedModeOperationArg[];
};

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseInteger(item?: StackItem): bigint {
  if (!item || item.type !== "Integer") return 0n;
  return BigInt(item.value || "0");
}

function decodeByteString(item?: StackItem): string {
  if (!item || item.type !== "ByteString") return "";
  const bytes = Buffer.from(item.value || "", "base64");
  try {
    const text = bytes.toString("utf8");
    if (/^[\x20-\x7E\s]+$/.test(text)) {
      return text;
    }
  } catch {
    // fall through to binary decoding
  }
  if (bytes.length === 20) {
    return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
  }
  if (bytes.length === 32) {
    return `0x${bytes.toString("hex")}`;
  }
  return item.value || "";
}

function parseStackValue(item: StackItem): unknown {
  switch (item.type) {
    case "Integer":
      return item.value;
    case "Boolean":
      return item.value;
    case "ByteString":
      return decodeByteString(item);
    case "Array":
    case "Struct":
      return item.value.map(parseStackValue);
    case "Map":
      return Object.fromEntries(item.value.map((entry) => [String(parseStackValue(entry.key)), parseStackValue(entry.value)]));
    default:
      return null;
  }
}

function parseJSONRecord(value: string): Dict | null {
  const source = String(value || "").trim();
  if (!source) return null;
  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Dict) : null;
  } catch {
    return null;
  }
}

function parseJSONArray(value: string): unknown[] | null {
  const source = String(value || "").trim();
  if (!source) return null;
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function addressToScriptHash(address: string): string {
  if (!address) return "";
  if (address.startsWith("0x")) return address.toLowerCase();
  try {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let num = 0n;
    for (const char of address) {
      const idx = ALPHABET.indexOf(char);
      if (idx < 0) return "";
      num = num * 58n + BigInt(idx);
    }
    const hex = num.toString(16).padStart(50, "0");
    const scriptHashHex = hex.substring(2, 42);
    const reversed = scriptHashHex.match(/.{2}/g)?.reverse().join("") ?? "";
    return `0x${reversed.toLowerCase()}`;
  } catch {
    return "";
  }
}

function parseFixed8Integer(value: string, decimals = 8): string {
  const normalized = String(value || "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  const negative = normalized.startsWith("-");
  const [wholeRaw, fractionRaw = ""] = normalized.replace(/^-/, "").split(".");
  const whole = wholeRaw || "0";
  const fraction = `${fractionRaw}${"0".repeat(decimals)}`.slice(0, decimals);
  const combined = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  return negative ? `-${combined}` : combined;
}

function normalizeUpdatedAt(value: bigint): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const ms = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  return new Date(ms).toISOString();
}

function resolveRegistries(manifest: Dict, network: Network) {
  const composition = asObject(manifest.contract_composition);
  const registries = asObject(composition.registries);
  const defaults = SHARED_RUNTIME_DEFAULTS[network];
  return {
    moduleRegistry: String(registries.module_registry || defaults.moduleRegistry || "").trim(),
    recipeRegistry: String(registries.recipe_registry || defaults.recipeRegistry || "").trim(),
    instanceRegistry: String(registries.instance_registry || defaults.instanceRegistry || "").trim(),
  };
}

function resolveInstanceId(app: MiniAppInfo): string {
  const composition = asObject(asObject(app.manifest).contract_composition);
  return String(composition.instance_id || "").trim();
}

function decodeInstanceInfo(item?: StackItem): SharedModeInstanceInfo | null {
  if (!item || item.type !== "Struct") return null;
  const fields = item.value;
  return {
    instanceId: decodeByteString(fields[0]),
    appId: decodeByteString(fields[1]),
    recipeId: decodeByteString(fields[2]),
    recipeVersion: decodeByteString(fields[3]),
    runtimeMode: decodeByteString(fields[4]),
    ownerHash: decodeByteString(fields[5]) || null,
    operatorHash: decodeByteString(fields[6]) || null,
    developerHash: decodeByteString(fields[7]) || null,
    routerContractHash: decodeByteString(fields[8]) || null,
    moduleBindings: parseJSONRecord(decodeByteString(fields[9])),
    configHash: decodeByteString(fields[10]) || null,
    frontendRef: decodeByteString(fields[11]) || null,
    status: Number(parseInteger(fields[12])),
    upgradePending: fields[13]?.type === "Boolean" ? Boolean(fields[13].value) : false,
    updatedAt: normalizeUpdatedAt(parseInteger(fields[14])),
  };
}

function decodeRecipeInfo(item?: StackItem): SharedModeRecipeInfo | null {
  if (!item || item.type !== "Struct") return null;
  const fields = item.value;
  return {
    recipeId: decodeByteString(fields[0]),
    version: decodeByteString(fields[1]),
    moduleRefs: parseJSONArray(decodeByteString(fields[2])),
    requiredFields: parseJSONRecord(decodeByteString(fields[3])),
    operationSchema: parseJSONRecord(decodeByteString(fields[4])),
    allowedRuntimeMode: decodeByteString(fields[5]) || null,
    routerTemplateId: decodeByteString(fields[6]) || null,
    compatibilityMetadata: parseJSONRecord(decodeByteString(fields[7])),
    active: fields[8]?.type === "Boolean" ? Boolean(fields[8].value) : false,
  };
}

function decodeModuleInfo(binding: string, item?: StackItem): SharedModeModuleInfo | null {
  if (!item || item.type !== "Struct") return null;
  const fields = item.value;
  return {
    binding,
    moduleId: decodeByteString(fields[0]),
    version: decodeByteString(fields[1]),
    contractHash: decodeByteString(fields[2]) || null,
    riskProfile: decodeByteString(fields[5]) || null,
    compatibilityMetadata: parseJSONRecord(decodeByteString(fields[6])),
    active: fields[7]?.type === "Boolean" ? Boolean(fields[7].value) : false,
  };
}

function extractBindings(instance: SharedModeInstanceInfo): SharedModeModuleBinding[] {
  const bindings = asObject(instance.moduleBindings);
  return Object.entries(bindings)
    .map(([binding, value]) => {
      const item = asObject(value);
      const moduleId = String(item.module_id || "").trim();
      const version = String(item.version || "").trim();
      if (!moduleId || !version) return null;
      return { binding, moduleId, version };
    })
    .filter((item): item is SharedModeModuleBinding => Boolean(item));
}

export function isSharedModeApp(app: MiniAppInfo | null | undefined): boolean {
  if (!app?.manifest) return false;
  const composition = asObject(asObject(app.manifest).contract_composition);
  return String(composition.mode || "").trim().toLowerCase() === "shared";
}

export function resolveSharedOperationRecipe(
  app: MiniAppInfo,
  operationMethod: string,
): SharedModeOperationRecipe | null {
  const manifest = asObject(app.manifest);
  const frontendComposition = asObject(manifest.frontend_composition);
  const recipes = asArray(frontendComposition.operation_recipes);
  for (const entry of recipes) {
    const recipe = asObject(entry);
    const operation = String(recipe.operation || "").trim();
    if (!operation || operation !== operationMethod) continue;
    const binding = String(recipe.binding || "").trim();
    const method = String(recipe.method || "").trim();
    const args = asArray(recipe.args)
      .map((arg) => asObject(arg))
      .map((arg) => ({
        source: String(arg.source || "").trim() || undefined,
        type: (String(arg.type || "").trim() as SharedModeOperationArg["type"]) || undefined,
        scale: typeof arg.scale === "number" ? arg.scale : undefined,
        value: arg.value as SharedModeOperationArg["value"],
      }));
    if (!binding || !method) return null;
    return { operation, binding, method, args };
  }
  return null;
}

export function buildSharedInvokeArgs(
  recipe: SharedModeOperationRecipe,
  values: Record<string, string>,
  runtime: SharedModeRuntimeInfo,
  walletAddress: string,
): Array<{ type: string; value: unknown }> {
  return recipe.args.map((arg) => {
    const source = String(arg.source || "").trim();
    let rawValue: unknown = arg.value ?? "";

    if (source === "instance.instanceId") {
      rawValue = runtime.instance.instanceId;
    } else if (source === "wallet.address") {
      rawValue = walletAddress;
    } else if (source.startsWith("input.")) {
      rawValue = values[source.slice("input.".length)] ?? "";
    }

    const type = arg.type || "String";

    if (type === "Hash160") {
      const hash = addressToScriptHash(String(rawValue || "").trim());
      if (!/^0x[0-9a-f]{40}$/.test(hash)) {
        throw new Error(`Invalid Hash160 source for ${source || "literal"}.`);
      }
      return { type, value: hash };
    }

    if (type === "Integer") {
      const numeric = arg.scale !== undefined
        ? parseFixed8Integer(String(rawValue || ""), arg.scale)
        : String(rawValue || "").trim();
      if (!/^-?\d+$/.test(numeric)) {
        throw new Error(`Invalid integer source for ${source || "literal"}.`);
      }
      return { type, value: numeric };
    }

    if (type === "Boolean") {
      return { type, value: String(rawValue).trim().toLowerCase() === "true" };
    }

    return { type, value: rawValue };
  });
}

export async function resolveSharedModeRuntime(
  app: MiniAppInfo,
  network: Network = "testnet",
): Promise<SharedModeRuntimeInfo | null> {
  if (!isSharedModeApp(app)) return null;

  const manifest = asObject(app.manifest);
  const instanceId = resolveInstanceId(app);
  if (!instanceId) return null;

  const registries = resolveRegistries(manifest, network);
  if (!registries.instanceRegistry || !registries.recipeRegistry || !registries.moduleRegistry) {
    return null;
  }

  const instanceRes = await invokeRead(
    registries.instanceRegistry,
    "getInstance",
    [{ type: "String", value: instanceId }],
    network,
  );
  const instance = decodeInstanceInfo(instanceRes.stack?.[0]);
  if (!instance || !instance.instanceId) return null;

  const recipeRes = await invokeRead(
    registries.recipeRegistry,
    "getRecipe",
    [
      { type: "String", value: instance.recipeId },
      { type: "String", value: instance.recipeVersion },
    ],
    network,
  );
  const recipe = decodeRecipeInfo(recipeRes.stack?.[0]);

  const modules: SharedModeModuleInfo[] = [];
  for (const binding of extractBindings(instance)) {
    const moduleRes = await invokeRead(
      registries.moduleRegistry,
      "getModule",
      [
        { type: "String", value: binding.moduleId },
        { type: "String", value: binding.version },
      ],
      network,
    );
    const decoded = decodeModuleInfo(binding.binding, moduleRes.stack?.[0]);
    if (decoded) modules.push(decoded);
  }

  return {
    network,
    registries,
    instance,
    recipe,
    modules,
  };
}
