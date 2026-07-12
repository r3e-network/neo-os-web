/**
 * framework/platform-surface — app.platform host detection, launch params and
 * canonical Dora explorer links (RFC P0-1 residual index.ts split, moved
 * verbatim from index.ts).
 *
 * - `host` / `isOneGate` / `isMiniAppPlatform`: shell detection from the
 *   launch-context source (falling back to the iframe heuristic).
 * - `param` / `params`: raw and typed launch-param decode (RFC P1-7).
 * - `network` / `explorer`: sync launch-context network info + the platform
 *   host-app's Dora URL scheme.
 */

import type {
  FrameworkHost,
  FrameworkLaunchContext,
  FrameworkPlatformSurface,
} from "./types";

export interface PlatformSurfaceDeps {
  appId: string;
  /** Live accessor for the launch context (hosts can hydrate late). */
  launchContext: () => Partial<FrameworkLaunchContext> | undefined;
}

/**
 * Build the `app.platform` surface (see module doc).
 *
 * @example
 * ```ts
 * const platform = createPlatformSurface({ appId, launchContext: () => ctx.launchContext });
 * const { tab } = platform.params({ tab: (raw) => raw ?? "overview" });
 * ```
 */
export function createPlatformSurface(deps: PlatformSurfaceDeps): FrameworkPlatformSurface {
  const platform: FrameworkPlatformSurface = {
    appId: deps.appId,
    launch: deps.launchContext() ?? {},
    get host(): FrameworkHost {
      const source = String(deps.launchContext()?.source ?? "").trim().toLowerCase();
      if (source === "onegate") return "onegate";
      if (typeof window !== "undefined" && window.parent !== window) return "miniapp-platform";
      return "standalone";
    },
    get isOneGate() {
      return this.host === "onegate";
    },
    get isMiniAppPlatform() {
      return this.host === "miniapp-platform";
    },
    param(key: string, fallback = ""): string {
      return deps.launchContext()?.params?.[key] ?? fallback;
    },
    /**
     * Typed launch-param decode (RFC P1-7): field-name → coercer, invoked
     * with the RAW param string (or undefined when absent).
     */
    params<T>(schema: { [K in keyof T]: (raw: string | undefined) => T[K] }): T {
      const out = {} as T;
      for (const key of Object.keys(schema) as Array<keyof T & string>) {
        out[key] = schema[key](deps.launchContext()?.params?.[key]);
      }
      return out;
    },
    /**
     * Sync network info from the launch context (default testnet). For the
     * wallet-verified network use the async `chain.detectNetwork()`.
     */
    network(): { name: string; isMainnet: boolean } {
      const name = String(deps.launchContext()?.network ?? "testnet").trim().toLowerCase() || "testnet";
      return { name, isMainnet: name.includes("mainnet") };
    },
    /**
     * Canonical Dora explorer links (RFC P1-7) — the platform host-app's
     * URL scheme (`https://dora.coz.io/<kind>/neo3/<network>/<value>`),
     * previously copy-pasted per app in utils/explorer.ts.
     */
    explorer: {
      tx(txid: string): string {
        const id = String(txid ?? "").trim();
        if (!id) return "";
        const segment = platform.network().isMainnet ? "mainnet" : "testnet";
        return `https://dora.coz.io/transaction/neo3/${segment}/${encodeURIComponent(id)}`;
      },
      address(address: string): string {
        const value = String(address ?? "").trim();
        if (!value) return "";
        const segment = platform.network().isMainnet ? "mainnet" : "testnet";
        return `https://dora.coz.io/address/neo3/${segment}/${encodeURIComponent(value)}`;
      },
      contract(scriptHash: string): string {
        const value = String(scriptHash ?? "").trim();
        if (!value) return "";
        const segment = platform.network().isMainnet ? "mainnet" : "testnet";
        return `https://dora.coz.io/contract/neo3/${segment}/${encodeURIComponent(value)}`;
      },
    },
  };
  return platform;
}
