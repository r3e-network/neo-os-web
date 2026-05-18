import { afterEach, vi } from "vitest";

import { useGasLuckyPool } from "../../gas-lucky-pool/src/composables/useGasLuckyPool";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";
import { addressToScriptHash } from "@shared/utils/neo";

export { addressToScriptHash, useGasLuckyPool };

export const OWNER = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
export const ONEGATE_OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
export const CLAIM_KEY = "ogv_test_key_1234567890";

export function t(key: string) {
  return key;
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
