import type { OperationParam } from "@/components/types";

export {
  getLaunchParam,
  parseMiniAppLaunchContext,
  readMiniAppLaunchContext,
} from "../../../apps/shared/utils/launch-params";
export type {
  MiniAppLaunchContext,
  MiniAppLaunchNetwork,
} from "../../../apps/shared/utils/launch-params";

function parseSelectOptions(
  options: OperationParam["options"],
): Array<{ value: string }> {
  if (!options) return [];
  if (Array.isArray(options)) {
    return (options as unknown[])
      .map((option) => {
        if (typeof option === "string") return { value: option.trim() };
        if (!option || typeof option !== "object") return { value: "" };
        return {
          value: String((option as { value?: unknown }).value ?? "").trim(),
        };
      })
      .filter((option) => Boolean(option.value));
  }
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed)
      ? parseSelectOptions(parsed as OperationParam["options"])
      : [];
  } catch {
    return options
      .split(",")
      .map((item) => ({ value: item.trim() }))
      .filter((option) => Boolean(option.value));
  }
}

function initialParamValue(param: OperationParam): string {
  if (param.default_value !== undefined && param.default_value !== null) {
    return String(param.default_value);
  }
  if (param.type === "select") {
    return parseSelectOptions(param.options)[0]?.value ?? "";
  }
  return "";
}

const launchParamAliases: Record<string, string[]> = {
  aaAddress: ["aa", "account", "accountAddress", "sender"],
  accountIdHash: ["accountId", "accountIdInput", "account", "seed"],
  accountIdInput: ["accountId", "accountIdHash", "account", "seed"],
  accountSeed: ["accountId", "accountIdHash", "account", "seed"],
  allowedMethod: ["method", "scope", "operation"],
  backupOwner: ["owner", "ownerAddress", "recoveryOwner"],
  claimKey: ["key", "code", "k"],
  poolId: ["pool", "id"],
  envelopeId: ["envelope", "id"],
  anchorAppId: ["anchor", "anchorId", "anchor_id", "appId", "app_id"],
  dappId: ["dapp", "paymaster", "paymasterDappId", "paymaster_dapp_id"],
  escapeTimelock: ["timelock", "escapeWindow", "duration"],
  expiresAt: ["expiry", "expiration", "expires"],
  hookHash: ["hook", "hookContract", "hookContractHash"],
  machineId: ["machine", "machine_id", "id"],
  payloadJson: ["payload", "calldata", "metaInvocation", "meta_invocation"],
  query: ["q", "search"],
  q: ["query", "search"],
  sponsorAmount: ["gas", "amount", "budget", "sponsorGas"],
  sessionPublicKey: ["sessionKey", "publicKey", "pubkey"],
  targetContract: [
    "target",
    "targetHash",
    "contract",
    "contractHash",
    "scriptHash",
  ],
  verifierHash: ["verifier", "verifierContract", "verifierContractHash"],
  verifierParamsHex: ["verifierParams", "paramsHex", "params"],
};

function launchValueForParam(
  name: string,
  launchParams: Record<string, string> | null | undefined,
): string {
  const keys = [name, ...(launchParamAliases[name] ?? [])];
  for (const key of keys) {
    const value = String(launchParams?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export function buildLaunchParamValues(
  params: OperationParam[],
  launchParams: Record<string, string> | null | undefined,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const param of params) {
    const launched = launchValueForParam(param.name, launchParams);
    values[param.name] = launched || initialParamValue(param);
  }
  return values;
}
