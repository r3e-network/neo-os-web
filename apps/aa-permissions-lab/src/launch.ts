import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";

export function getPermissionsLaunchDefaults(
  launchContext: Pick<MiniAppLaunchContext, "params"> | null | undefined,
) {
  return {
    accountIdHash: getLaunchParam(launchContext, [
      "accountIdHash",
      "accountId",
      "accountIdInput",
      "account",
      "seed",
    ]),
    verifierHash: getLaunchParam(launchContext, [
      "verifierHash",
      "verifier",
      "verifierContract",
      "verifierContractHash",
    ]),
    verifierParamsHex: getLaunchParam(launchContext, [
      "verifierParamsHex",
      "verifierParams",
      "paramsHex",
      "params",
    ]),
    hookHash: getLaunchParam(launchContext, [
      "hookHash",
      "hook",
      "hookContract",
      "hookContractHash",
    ]),
  };
}
