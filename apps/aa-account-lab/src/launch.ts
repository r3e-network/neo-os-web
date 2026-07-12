import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";

export const DEFAULT_ESCAPE_TIMELOCK = "2592000";

export function getAccountLabLaunchDefaults(
  launchContext: Pick<MiniAppLaunchContext, "params"> | null | undefined,
) {
  return {
    accountIdInput: getLaunchParam(launchContext, [
      "accountIdInput",
      "accountId",
      "accountIdHash",
      "account",
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
    backupOwner: getLaunchParam(launchContext, [
      "backupOwner",
      "owner",
      "ownerAddress",
      "recoveryOwner",
    ]),
    escapeTimelock: getLaunchParam(
      launchContext,
      ["escapeTimelock", "timelock", "escapeWindow", "duration"],
      DEFAULT_ESCAPE_TIMELOCK,
    ),
  };
}
