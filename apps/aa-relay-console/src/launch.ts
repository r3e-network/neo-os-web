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

export function getDefaultRelayPayload(network: NeoNetwork = getNetwork()) {
  // This is deliberately a review template, not a fake submittable request.
  // The route account is substituted for $AA_ACCOUNT during preparation; the
  // downstream target and method remain blank until the operator supplies the
  // real call. The deadline uses Neo Runtime.Time milliseconds.
  return JSON.stringify(
    {
      metaInvocation: {
        scriptHash: getExternalIntegrationConfig(network).contracts.aaCore,
        operation: "executeUserOp",
        args: [
          { type: "Hash160", value: "$AA_ACCOUNT" },
          {
            type: "Struct",
            value: [
              { type: "Hash160", value: "" },
              { type: "String", value: "" },
              { type: "Array", value: [] },
              { type: "Integer", value: "0" },
              { type: "Integer", value: String(Date.now() + 15 * 60 * 1000) },
              { type: "ByteArray", value: "" },
            ],
          },
        ],
      },
    },
    null,
    2,
  );
}

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
    payloadJson: getLaunchParam(
      launchContext,
      ["payloadJson", "payload", "calldata", "metaInvocation"],
      getDefaultRelayPayload(network),
    ),
  };
}
