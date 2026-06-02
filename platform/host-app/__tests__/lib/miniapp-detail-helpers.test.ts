import {
  buildFrontendOperationQuery,
  buildInvokeArgs,
  frontendOperationFeedback,
  isFrontendLocalOperation,
  prepareFrontendOperationQueryValues,
  readSensitiveFrontendOperationValue,
  resolveNetworkContractHash,
  resolveMiniAppDetailRouteId,
  supportsPageCatalogNetwork,
  withBundledAuthoritativeFields,
} from "@/lib/miniapp-detail-helpers";
import type { MiniAppInfo } from "@/components/types";

function miniApp(overrides: Partial<MiniAppInfo> = {}): MiniAppInfo {
  return {
    app_id: "miniapp-unbreakablevault",
    name: "Unbreakable Vault",
    description: "Vault",
    icon: "vault",
    category: "utility",
    entry_url: "/miniapps/unbreakablevault/index.html",
    dapp_url: null,
    permissions: {},
    ...overrides,
  };
}

describe("miniapp detail route helpers", () => {
  it("maps the public MiniApp Factory slug to the manifest app id", () => {
    expect(resolveMiniAppDetailRouteId("miniapp-factory")).toBe(
      "miniapp-miniapp-factory",
    );
  });

  it("keeps OneGate Vault compatibility routes on the canonical gas lucky pool app", () => {
    expect(resolveMiniAppDetailRouteId("onegate-vault")).toBe(
      "miniapp-gas-lucky-pool",
    );
    expect(resolveMiniAppDetailRouteId("miniapp-onegate-vault")).toBe(
      "miniapp-gas-lucky-pool",
    );
  });

  it("keeps bundled dapp_url when remote catalog rows only have a legacy entry_url", () => {
    const merged = withBundledAuthoritativeFields(
      miniApp(),
      miniApp({
        entry_url: "mf://manifest?app=miniapp-unbreakablevault",
        dapp_url: "/miniapps/unbreakable-vault/index.html",
      }),
    );

    expect(merged?.entry_url).toBe("mf://manifest?app=miniapp-unbreakablevault");
    expect(merged?.dapp_url).toBe("/miniapps/unbreakable-vault/index.html");
  });

  it("resolves network contract hashes from top-level catalog contracts", () => {
    const app = miniApp({
      contract_hash: null,
      contracts: {
        "neo-n3-mainnet": "0x198bfcccabb9b73181f23b5af22fe73afdc6c3aa",
        "neo-n3-testnet": "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
      },
      manifest: {
        supported_networks: ["neo-n3-mainnet", "neo-n3-testnet"],
      },
    });

    expect(supportsPageCatalogNetwork(app, "neo-n3-testnet")).toBe(true);
    expect(resolveNetworkContractHash(app, "neo-n3-testnet")).toBe(
      "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
    );
  });

  it("keeps remote top-level contracts when merging bundled app fields", () => {
    const merged = withBundledAuthoritativeFields(
      miniApp({
        contract_hash: null,
        contracts: {
          "neo-n3-testnet": "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
        },
      }),
      miniApp({
        dapp_url: "/miniapps/unbreakable-vault/index.html",
        manifest: {
          supported_networks: ["neo-n3-testnet"],
        },
      }),
    );

    expect(resolveNetworkContractHash(merged!, "neo-n3-testnet")).toBe(
      "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
    );
  });

  it("scales human GAS amount inputs when an operation declares fixed8 scale", () => {
    expect(
      buildInvokeArgs(
        [
          {
            name: "amount",
            type: "amount",
            label: "Wager (GAS)",
            required: true,
            scale: 8,
          },
        ],
        { amount: "0.05" },
        "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
      ),
    ).toEqual([{ type: "Integer", value: "5000000" }]);
  });

  it("keeps sensitive frontend-local operation values out of URL query params", () => {
    const prepared = prepareFrontendOperationQueryValues(
      "miniapp-oracle-seal-console",
      {
        name: "Seal Payload",
        method: "sealOracleRequest",
        params: [
          {
            name: "endpoint",
            type: "string",
            label: "Payload",
            required: true,
            sensitive: true,
          },
        ],
      },
      { endpoint: "{\"secret\":\"do-not-leak\"}" },
    );
    const ref = prepared.endpoint_ref;

    expect(prepared).not.toHaveProperty("endpoint");
    expect(ref).toMatch(/^sensitive:/);
    expect(
      readSensitiveFrontendOperationValue(ref, {
        appId: "miniapp-oracle-seal-console",
        method: "sealOracleRequest",
        paramName: "endpoint",
      }),
    ).toBe("{\"secret\":\"do-not-leak\"}");

    const query = buildFrontendOperationQuery(
      {
        endpoint: "{\"secret\":\"stale-leak\"}",
        network: "testnet",
      },
      "sealOracleRequest",
      prepared,
      "neo-n3-testnet",
    );

    expect(JSON.stringify(query)).not.toContain("do-not-leak");
    expect(JSON.stringify(query)).not.toContain("stale-leak");
    expect(query).toMatchObject({
      operation: "sealOracleRequest",
      endpoint_ref: ref,
      network: "testnet",
    });
  });

  it("treats treasury disbursement as an embedded frontend operation", () => {
    expect(isFrontendLocalOperation("submitDisbursement")).toBe(true);
    expect(frontendOperationFeedback("submitDisbursement")).toContain(
      "Treasury disbursement parameters applied",
    );
  });
});
