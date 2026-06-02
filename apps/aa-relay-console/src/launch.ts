import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";
import {
  getExternalIntegrationConfig,
  getNetwork,
  resolveNeoNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";

export const DEFAULT_SPONSOR_AMOUNT = "0.1";

export function getDefaultRelayPayload(network: NeoNetwork = getNetwork()) {
  return JSON.stringify(
    {
      metaInvocation: {
        scriptHash: getExternalIntegrationConfig(network).contracts.aaCore,
      },
    },
    null,
    2,
  );
}

export const DEFAULT_RELAY_PAYLOAD = getDefaultRelayPayload("mainnet");

function getRelayLaunchNetwork(
  launchContext:
    | (Pick<MiniAppLaunchContext, "params"> &
        Partial<Pick<MiniAppLaunchContext, "network">>)
    | null
    | undefined,
): NeoNetwork {
  return (
    launchContext?.network ??
    resolveNeoNetwork(
      getLaunchParam(launchContext, ["network", "chain"], getNetwork()),
    )
  );
}

export function getRelayLaunchDefaults(
  launchContext:
    | (Pick<MiniAppLaunchContext, "params"> &
        Partial<Pick<MiniAppLaunchContext, "network">>)
    | null
    | undefined,
) {
  const network = getRelayLaunchNetwork(launchContext);
  return {
    aaAddress: getLaunchParam(launchContext, [
      "aaAddress",
      "aa",
      "account",
      "accountAddress",
      "sender",
    ]),
    dappId: getLaunchParam(launchContext, [
      "dappId",
      "dapp",
      "paymaster",
      "paymasterDappId",
      "paymaster_dapp_id",
    ]),
    sponsorAmount: getLaunchParam(
      launchContext,
      ["sponsorAmount", "sponsorGas", "gas", "amount", "budget"],
      DEFAULT_SPONSOR_AMOUNT,
    ),
    payloadJson: getLaunchParam(
      launchContext,
      ["payloadJson", "payload", "calldata", "metaInvocation"],
      getDefaultRelayPayload(network),
    ),
  };
}
