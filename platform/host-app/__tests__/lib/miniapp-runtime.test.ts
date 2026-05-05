import type { MiniAppInfo, OperationEntry } from "@/components/types";
import {
  injectRuntimeAppIdParam,
  resolveMiniAppContractDomain,
  resolveMiniAppRuntime,
  supportsRuntimeNetwork,
} from "@/lib/miniapp-runtime";

const lastSurvivorApp = {
  app_id: "miniapp-last-survivor",
  name: "Last Survivor",
  description: "Countdown auction",
  icon: "timer",
  category: "gaming",
  entry_url: "mf://manifest?app=miniapp-last-survivor",
  contract_hash: "0xlegacy",
  permissions: {},
  manifest: {
    runtime: {
      mode: "platform",
      modules: [
        {
          binding: "countdown-auction",
          platform: "PlatformGame",
          appId: "miniapp-last-survivor",
          moduleType: 1,
          networks: {
            "neo-n3-testnet": {
              contract_hash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
              registered: true,
              domain: "lastsurvivor.testnet.miniapp.neo",
            },
            "neo-n3-mainnet": {
              contract_hash: "",
              registered: false,
            },
          },
        },
      ],
    },
  },
} satisfies MiniAppInfo;

describe("miniapp runtime resolver", () => {
  it("resolves a registered platform runtime for the selected network", () => {
    expect(resolveMiniAppRuntime(lastSurvivorApp, "neo-n3-testnet")).toMatchObject({
      mode: "platform",
      appId: "miniapp-last-survivor",
      platform: "PlatformGame",
      contractHash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
      registered: true,
      writesEnabled: true,
    });
  });

  it("keeps writes disabled when the platform app is not registered on a network", () => {
    expect(resolveMiniAppRuntime(lastSurvivorApp, "neo-n3-mainnet")).toMatchObject({
      mode: "platform",
      contractHash: null,
      registered: false,
      writesEnabled: false,
    });
  });

  it("uses runtime network support only when a runtime contract exists", () => {
    expect(supportsRuntimeNetwork(lastSurvivorApp, "neo-n3-testnet")).toBe(true);
    expect(supportsRuntimeNetwork(lastSurvivorApp, "neo-n3-mainnet")).toBe(false);
  });

  it("resolves explicit platform runtime domains from the selected network binding", () => {
    expect(resolveMiniAppContractDomain(lastSurvivorApp, "neo-n3-testnet")).toMatchObject({
      network: "neo-n3-testnet",
      contractHash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
      domain: "lastsurvivor.testnet.miniapp.neo",
      source: "runtime",
    });
  });

  it("resolves dedicated contract domains from manifest network metadata", () => {
    const app = {
      app_id: "miniapp-redenvelope",
      name: "Red Envelope",
      description: "GAS gift packets",
      icon: "gift",
      category: "social",
      entry_url: "mf://manifest?app=miniapp-redenvelope",
      contract_hash: null,
      permissions: {},
      manifest: {
        contracts: {
          "neo-n3-mainnet": "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
        },
        contract_domains: {
          mainnet: "redenvelope.miniapp.neo",
        },
      },
    } satisfies MiniAppInfo;

    expect(resolveMiniAppContractDomain(app, "neo-n3-mainnet")).toMatchObject({
      network: "neo-n3-mainnet",
      contractHash: "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
      domain: "redenvelope.miniapp.neo",
      source: "manifest",
    });
  });

  it("falls back to configured mainnet domains for known MiniApp contracts", () => {
    const app = {
      app_id: "miniapp-neo-pay",
      name: "NeoPay",
      description: "Payment streams",
      icon: "wallet",
      category: "defi",
      entry_url: "mf://manifest?app=miniapp-neo-pay",
      contract_hash: "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34",
      permissions: {},
      manifest: {},
    } satisfies MiniAppInfo;

    expect(resolveMiniAppContractDomain(app, "mainnet")).toMatchObject({
      domain: "neopay.miniapp.neo",
      source: "configured",
    });
  });

  it("derives an expected mainnet domain for unmapped MiniApp contracts", () => {
    const app = {
      app_id: "miniapp-unbreakable-vault",
      name: "Unbreakable Vault",
      description: "Time-locked vault",
      icon: "lock",
      category: "defi",
      entry_url: "mf://manifest?app=miniapp-unbreakable-vault",
      contract_hash: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
      permissions: {},
      manifest: {},
    } satisfies MiniAppInfo;

    expect(resolveMiniAppContractDomain(app, "neo-n3-mainnet")).toMatchObject({
      domain: "unbreakablevault.miniapp.neo",
      source: "expected",
    });
  });

  it("injects hidden platform appId before user supplied operation params", () => {
    const runtime = resolveMiniAppRuntime(lastSurvivorApp, "neo-n3-testnet");
    const operation: OperationEntry = {
      name: "Buy keys",
      method: "buyCountdownKeys",
      params: [{ name: "keyCount", type: "integer", required: true }],
    };

    expect(injectRuntimeAppIdParam(operation, runtime)).toMatchObject({
      params: [
        { name: "appId", type: "string", default_value: "miniapp-last-survivor", hidden: true },
        { name: "keyCount", type: "integer", required: true },
      ],
    });
  });
});
