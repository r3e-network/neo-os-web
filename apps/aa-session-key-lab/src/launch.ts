import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";

// Kept under the historical export name for launch compatibility. Production
// flows require an existing exact AccountId; a demo seed must never fabricate
// one that is not registered on AA Core.
export const DEFAULT_SESSION_ACCOUNT_SEED = "";
export const DEFAULT_SESSION_ALLOWED_METHOD = "claimRewards";
export const DEFAULT_SESSION_DAPP_ID = "miniapp-aa-session-key-lab";
export const DEFAULT_SESSION_SPONSOR_AMOUNT = "0.1";

export function getDefaultSessionExpiryTimestamp() {
  return String(Math.floor(Date.now() / 1000) + 3600);
}

export function getSessionKeyLaunchDefaults(
  launchContext: Pick<MiniAppLaunchContext, "params"> | null | undefined,
) {
  return {
    accountSeed: getLaunchParam(
      launchContext,
      ["accountId", "accountIdHash", "account", "accountSeed"],
      DEFAULT_SESSION_ACCOUNT_SEED,
    ),
    sessionPublicKey: getLaunchParam(launchContext, [
      "sessionPublicKey",
      "sessionKey",
      "publicKey",
      "pubkey",
    ]),
    targetContract: getLaunchParam(launchContext, [
      "targetContract",
      "target",
      "targetHash",
      "contract",
      "contractHash",
      "scriptHash",
    ]),
    allowedMethod: getLaunchParam(
      launchContext,
      ["allowedMethod", "method", "scope", "operation"],
      DEFAULT_SESSION_ALLOWED_METHOD,
    ),
    expiresAt: getLaunchParam(
      launchContext,
      ["expiresAt", "expiry", "expiration", "expires"],
      getDefaultSessionExpiryTimestamp(),
    ),
    dappId: getLaunchParam(
      launchContext,
      ["dappId", "dapp", "paymaster", "paymasterDappId", "paymaster_dapp_id"],
      DEFAULT_SESSION_DAPP_ID,
    ),
    sponsorAmount: getLaunchParam(
      launchContext,
      ["sponsorAmount", "sponsorGas", "gas", "amount", "budget"],
      DEFAULT_SESSION_SPONSOR_AMOUNT,
    ),
  };
}
