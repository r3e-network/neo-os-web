import { afterEach, vi } from "vitest";

import { useGasLuckyPool as useGasLuckyPoolImpl } from "../../gas-lucky-pool/src/composables/useGasLuckyPool";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";
import { addressToScriptHash } from "@shared/utils/neo";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService } from "@shared/services/ChainService";

export { addressToScriptHash };

export function useGasLuckyPool(
  options: Parameters<typeof useGasLuckyPoolImpl>[0],
) {
  return useGasLuckyPoolImpl({
    ...options,
    paidLaneEnabled: options.paidLaneEnabled ?? true,
    oneGateClaimEnabled: options.oneGateClaimEnabled ?? true,
  });
}

export const OWNER = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
export const ONEGATE_OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
export const CLAIM_KEY = "ogv_test_key_1234567890";

export function t(key: string) {
  return key;
}

/**
 * Wrap a mock chain in the MiniApp framework SDK the composable now consumes.
 * The framework chain layer forwards read/readArray/events/invoke/
 * invokeWithPayment/ensureWallet/address straight through, so every recorded
 * call and its arg shapes are byte-identical to the pre-migration chain calls.
 */
export function makeApp(chain: unknown) {
  return createMiniAppFramework(
    { services: { chain: chain as ChainService }, t } as never,
    { appId: "miniapp-gas-lucky-pool" },
  );
}

export function launch(poolId = "42") {
  return parseMiniAppLaunchContext(
    `https://neomini.app/miniapps/gas-lucky-pool/index.html?source=onegate&operation=claimPool&network=testnet&poolId=${poolId}`,
    "miniapp-gas-lucky-pool",
  );
}

export function keyLaunch(claimKey = CLAIM_KEY, extraParams = "") {
  return parseMiniAppLaunchContext(
    `https://onegate.space/app/23?key=${claimKey}&pool=pool-001&network=testnet${extraParams}`,
    "miniapp-gas-lucky-pool",
  );
}

afterEach(() => {
  vi.useRealTimers();
  delete (window as any).OneGate;
  delete (window as any).OneGateDapiProvider;
  delete (window as any).Neo;
  delete (window as any).NEP21Provider;
  delete (window as any).NEP21Providers;
  delete (window as any).__OneGateBridge;
  delete (window as any).__OneGateDapiCallback;
  delete (window as any).webkit;
});
