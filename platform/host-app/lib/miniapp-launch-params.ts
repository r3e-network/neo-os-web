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

function parseSelectOptions(options: OperationParam["options"]): Array<{ value: string }> {
  if (!options) return [];
  if (Array.isArray(options)) {
    return (options as unknown[])
      .map((option) => {
        if (typeof option === "string") return { value: option.trim() };
        if (!option || typeof option !== "object") return { value: "" };
        return { value: String((option as { value?: unknown }).value ?? "").trim() };
      })
      .filter((option) => Boolean(option.value));
  }
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parseSelectOptions(parsed as OperationParam["options"]) : [];
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
  claimKey: ["key", "code", "k"],
  poolId: ["pool", "id"],
  envelopeId: ["envelope", "id"],
  query: ["q", "search"],
  q: ["query", "search"],
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
