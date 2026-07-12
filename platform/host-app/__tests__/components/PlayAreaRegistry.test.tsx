import React from "react";
import fs from "fs";
import path from "path";
import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  PlayAreaRegistry,
  getNativePlayAreaKind,
  getNativePlayAreaOperationFallback,
  hasNativePlayArea,
} from "../../components/playarea/PlayAreaRegistry";
import { isChainRelevant } from "../../components/playarea/PlayAreaFallbacks";
import {
  buildEmbeddedDappUrl,
  buildEmbeddedWalletBridgeResultDetail,
} from "../../components/playarea/PlayAreaShared";
import { clearCouncilGovernanceClientCache } from "../../lib/council-governance-client";
import type { MiniAppCategory, MiniAppInfo } from "../../components/types";

type LocalMiniAppManifest = {
  appId: string;
  name: string;
  description: string;
  category: MiniAppCategory;
  entryUrl: string;
};

const MINIAPP_CATEGORIES = new Set<MiniAppCategory>([
  "gaming",
  "defi",
  "governance",
  "utility",
  "social",
  "nft",
  "data",
  "other",
]);

function normalizeMiniAppCategory(
  category: string | undefined,
): MiniAppCategory {
  const normalized = category?.trim() as MiniAppCategory | undefined;
  return normalized && MINIAPP_CATEGORIES.has(normalized)
    ? normalized
    : "utility";
}

function loadActiveMiniAppManifests() {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const appsRoot = path.join(repoRoot, "apps");

  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(appsRoot, entry.name, "neo-manifest.json"))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .map((manifestPath) => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        app_id?: string;
        id?: string;
        name?: string;
        description?: string;
        category?: string;
        urls?: { entry?: string };
      };
      const appId = manifest.app_id || manifest.id;
      if (!appId) return null;
      const slug = appId.replace(/^miniapp-/, "");
      return {
        appId,
        name: manifest.name || appId,
        description: manifest.description || "MiniApp",
        category: normalizeMiniAppCategory(manifest.category),
        entryUrl: manifest.urls?.entry || `/miniapps/${slug}/index.html`,
      } satisfies LocalMiniAppManifest;
    })
    .filter((manifest): manifest is LocalMiniAppManifest => Boolean(manifest))
    .sort((left, right) => left.appId.localeCompare(right.appId));
}

function loadBundledManifest(slug: string): Record<string, unknown> {
  const repoRoot = path.resolve(__dirname, "../../../..");
  return JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "apps", slug, "neo-manifest.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

const ACTIVE_MINIAPP_MANIFESTS = loadActiveMiniAppManifests();
const ACTIVE_MINIAPP_IDS = ACTIVE_MINIAPP_MANIFESTS.map(
  (manifest) => manifest.appId,
);
const PROFILED_MINIAPP_MANIFESTS = ACTIVE_MINIAPP_MANIFESTS.filter(
  (manifest) => getNativePlayAreaKind(manifest.appId) === "profiled",
);

const baseApp: MiniAppInfo = {
  app_id: "miniapp-last-survivor",
  name: "LastSurvivor",
  description: "Countdown auction",
  icon: "L",
  category: "gaming",
  entry_url: "mf://manifest?app=miniapp-last-survivor",
  permissions: {},
};
function renderPlayarea(
  app: Partial<MiniAppInfo>,
  launchContext?: React.ComponentProps<typeof PlayAreaRegistry>["launchContext"],
) {
  return render(
    <PlayAreaRegistry
      app={{ ...baseApp, ...app }}
      stats={[
        { label: "Countdown", value: "00:10:30", accent: true },
        { label: "Prize Pool", value: "12.50 GAS", accent: true },
        { label: "Status", value: "Active", accent: true },
        { label: "Total Machines", value: "3", accent: true },
      ]}
      statsMap={{
        Countdown: "00:10:30",
        "Prize Pool": "12.50 GAS",
        Status: "Active",
        "Key Price": "0.05 GAS",
        "Total Machines": "3",
        "Total Streams": "4",
      }}
      activity={{
        title: "Recent activity",
        rows: [
          {
            icon: "A",
            primary: "Current leader: 0x1234",
            secondary: "Round #8",
            amount: "12.50 GAS",
          },
        ],
      }}
      loading={false}
      error={null}
      contractHash="0x1234567890abcdef1234567890abcdef12345678"
      network="testnet"
      launchContext={
        launchContext ?? {
          appId: app.app_id ?? baseApp.app_id,
          source: "url",
          operation: null,
          tab: null,
          network: null,
          params: {},
          keys: [],
          hasParams: false,
          signature: "",
        }
      }
      onRefresh={jest.fn()}
    />,
  );
}

describe("PlayAreaRegistry", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    clearCouncilGovernanceClientCache();
    jest.restoreAllMocks();
  });

  it("uses canonical dApp slugs when profiled apps only provide manifest entry URLs", () => {
    expect(
      buildEmbeddedDappUrl(
        {
          ...baseApp,
          app_id: "miniapp-unbreakablevault",
          name: "Unbreakable Vault",
          entry_url: "mf://manifest?app=miniapp-unbreakablevault",
          dapp_url: null,
        },
        "testnet",
        null,
      ),
    ).toBe(
      "/miniapps/unbreakable-vault/index.html?network=testnet&source=embed",
    );
  });

  it("summarizes embedded wallet bridge transactions without exposing full payloads", () => {
    expect(
      buildEmbeddedWalletBridgeResultDetail({
        appId: "miniapp-dailycheckin",
        network: "testnet",
        requestMethod: "invoke",
        payload: {
          invocations: [
            {
              hash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
              operation: "transfer",
              args: [
                { type: "Hash160", value: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32" },
                { type: "Hash160", value: "0xaba84da240a55410d284a656fc8dae044e6ec1a5" },
                { type: "Integer", value: "100000" },
                { type: "String", value: "miniapp-dailycheckin:checkin" },
              ],
            },
          ],
        },
        result: {
          txid:
            "0x4b53a363fa1f0536b5112c31ad28295799319984730477432c6d6e63f0c7c7c4",
        },
      }),
    ).toMatchObject({
      appId: "miniapp-dailycheckin",
      network: "testnet",
      requestMethod: "invoke",
      txid:
        "0x4b53a363fa1f0536b5112c31ad28295799319984730477432c6d6e63f0c7c7c4",
      operation: "transfer",
      contractHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      memo: "miniapp-dailycheckin:checkin",
    });
  });

  it.each([
    ["miniapp-last-survivor", "Countdown auction arena"],
    ["miniapp-fogplay", "Coin flip table"],
    ["miniapp-gasbox", "GASBox gacha machine"],
    ["miniapp-redenvelope", "Open red envelope"],
    ["miniapp-dailycheckin", "Daily streak board"],
    ["miniapp-self-loan", "Self-repaying loan panel"],
    ["miniapp-profitanchor", "ProfitAnchor"],
    ["miniapp-trustanchor", "TrustAnchor"],
    ["miniapp-profitanchor-admin", "ProfitAnchor Admin"],
    ["miniapp-trustanchor-admin", "TrustAnchor Admin"],
    ["miniapp-neo-pay", "Payment stream builder"],
  ])("renders a native flagship playarea for %s", (appId, heading) => {
    renderPlayarea({
      app_id: appId,
      name: heading,
      category: appId.includes("profit") ? "defi" : "gaming",
    });

    expect(screen.getByTestId(`native-playarea-${appId}`)).toBeVisible();
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  });

  it("renders Council Governance as a real proposal workspace, not a ballot placeholder", async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/api/explorer/council-governance")) {
        return {
          ok: true,
          json: async () => ({
            source: "neo-explorer-ui",
            network: "testnet",
            candidates: [
              {
                id: "candidate-1",
                candidate:
                  "020000000000000000000000000000000000000000000000000000000000000000",
                displayName: "Neo Council",
                logoUrl: "https://example.test/neo-council.png",
                rank: 1,
                status: "council",
                votes: 21000000,
              },
            ],
            proposals: [
              {
                id: "proposal-42",
                number: 42,
                title: "Neo committee budget",
                status: "finalized",
                type: "policy",
                createdAt: "2026-05-01T00:00:00.000Z",
                endTime: "2026-05-08T00:00:00.000Z",
                proposerName: "Neo Council",
                councilVotes: { for: 9, against: 1, neutral: 1 },
                communityVotes: { for: 2, against: 0, neutral: 0 },
                messageCount: 5,
              },
            ],
          }),
        } as Response;
      }
      return {
        ok: false,
        json: async () => null,
      } as Response;
    }) as typeof fetch;

    renderPlayarea({
      app_id: "miniapp-council-governance",
      name: "Council Governance",
      category: "governance",
      description: "On-chain council proposals",
    });

    expect(hasNativePlayArea("miniapp-council-governance")).toBe(true);
    expect(
      screen.getByRole("heading", { name: "Council proposal workspace" }),
    ).toBeVisible();
    expect(screen.getByTitle("Council Governance dApp")).toHaveAttribute(
      "src",
      expect.stringContaining("/miniapps/council-governance/index.html?"),
    );
    expect(screen.getByText("Proposal queue")).toBeVisible();
    expect(screen.getByText("Total proposals")).toBeVisible();
    expect(await screen.findByText("Neo committee budget")).toBeVisible();
    expect(screen.queryByText("Council ballot")).not.toBeInTheDocument();
    expect(screen.queryByText("Stage council vote")).not.toBeInTheDocument();
  });

  it("does not show a false Council Governance empty state while live data is loading", () => {
    global.fetch = jest.fn(
      () => new Promise<Response>(() => undefined),
    ) as typeof fetch;

    renderPlayarea({
      app_id: "miniapp-council-governance",
      name: "Council Governance",
      category: "governance",
      description: "On-chain council proposals",
    });

    expect(screen.getByTestId("council-governance-loading")).toBeVisible();
    expect(screen.getByText("Loading live governance proposals")).toBeVisible();
    expect(
      screen.queryByText("No proposals on this network yet"),
    ).not.toBeInTheDocument();
  });

  it("opens Council Governance proposal details from Neo Explorer data", async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/api/explorer/council-governance")) {
        return {
          ok: true,
          json: async () => ({
            source: "neo-explorer-ui",
            network: "testnet",
            candidates: [],
            proposals: [
              {
                id: "proposal-9",
                number: 9,
                title: "Protocol fee review",
                status: "active",
                type: "policy",
                createdAt: "2026-05-10T00:00:00.000Z",
                endTime: "2026-05-17T00:00:00.000Z",
                proposerName: "Neo Council",
                councilVotes: { for: 4, against: 1, neutral: 0 },
                communityVotes: { for: 2, against: 0, neutral: 1 },
              },
            ],
          }),
        } as Response;
      }
      return {
        ok: false,
        json: async () => null,
      } as Response;
    }) as typeof fetch;

    renderPlayarea({
      app_id: "miniapp-council-governance",
      name: "Council Governance",
      category: "governance",
      description: "On-chain council proposals",
    });

    expect(await screen.findByText("Protocol fee review")).toBeVisible();
    const row = screen.getByTestId("council-proposal-row");
    expect(screen.getByText(/Neo Council · active/i)).toBeVisible();

    fireEvent.click(row);

    expect(screen.getByTestId("council-proposal-detail")).toBeVisible();
    expect(screen.getByText("Proposal details")).toBeVisible();
    expect(screen.getByText("4 for / 1 against / 0 neutral")).toBeVisible();
    expect(screen.queryByText(/020000000000000000/)).not.toBeInTheDocument();
  });

  it("does not pretend unprofiled Council candidates have verified names or logos", async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/api/explorer/council-governance")) {
        return {
          ok: true,
          json: async () => ({
            source: "neo-explorer-ui",
            network: "testnet",
            candidates: [
              {
                id: "candidate-raw",
                candidate: "0x8b915b5abcb81841face2afc42982c08a7e72b81",
                displayName: "Council node #1",
                profileSource: "unverified",
                rank: 1,
                status: "consensus",
                votes: 3001287,
              },
            ],
            proposals: [],
          }),
        } as Response;
      }
      return {
        ok: false,
        json: async () => null,
      } as Response;
    }) as typeof fetch;

    renderPlayarea({
      app_id: "miniapp-council-governance",
      name: "Council Governance",
      category: "governance",
      description: "On-chain council proposals",
    });

    expect(
      await screen.findAllByText("Unverified consensus node #1"),
    ).toHaveLength(2);
    expect(screen.getByText(/profile names or logos/i)).toBeVisible();
    expect(
      screen.queryByText(/Node names and logos are resolved/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/0x8b915b5abcb81841face2afc42982c08a7e72b81/i),
    ).not.toBeInTheDocument();
  });

  it("keeps Oracle Price Console focused on the clean feed symbol", () => {
    renderPlayarea({
      app_id: "miniapp-oracle-price-console",
      name: "Oracle Price Console",
      category: "utility",
      description: "Query the Morpheus price feed",
    });

    expect(screen.getByText("Feed symbol")).toBeVisible();
    expect(screen.getByText("Morpheus live price feed")).toBeVisible();
    expect(screen.getByText("NEO-USD")).toBeVisible();
    expect(screen.queryByText("TWELVEDATA:NEO-USD")).not.toBeInTheDocument();
  });

  it("opens the real Oracle VRF workbench instead of rebuilding its request as a host form", () => {
    render(
      <PlayAreaRegistry
        app={{
          ...baseApp,
          app_id: "miniapp-oracle-vrf-console",
          name: "Oracle VRF Workbench",
          category: "utility",
          description: "Prepare and verify signed randomness requests",
          dapp_url: "/miniapps/oracle-vrf-console/index.html",
        }}
        stats={[]}
        statsMap={{}}
        activity={null}
        loading={false}
        error={null}
        contractHash={null}
        network="testnet"
        launchContext={{
          appId: "miniapp-oracle-vrf-console",
          source: "onegate",
          operation: "buildOraclePackage",
          tab: null,
          network: "testnet",
          params: {
            consumer: "miniapp-fogplay",
            salt: "round-42",
            rounds: "3",
            mode: "batch-proof",
          },
          keys: ["consumer", "salt", "rounds", "mode"],
          hasParams: true,
          signature: "consumer=miniapp-fogplay&salt=round-42&rounds=3",
        }}
        onRefresh={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Oracle VRF workbench" }),
    ).toBeVisible();
    const frame = screen.getByTestId("oracle-vrf-dapp-frame");
    expect(frame).toHaveAttribute(
      "src",
      expect.stringContaining(
        "/miniapps/oracle-vrf-console/index.html?network=testnet&source=embed",
      ),
    );
    expect(frame).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
    );
    expect(screen.queryByText("Consumer")).not.toBeInTheDocument();
    expect(screen.queryByText("Request salt")).not.toBeInTheDocument();
    expect(screen.queryByText("batch-proof")).not.toBeInTheDocument();
    expect(getNativePlayAreaOperationFallback("miniapp-oracle-vrf-console"))
      .toEqual([]);
  });

  it("presents confidential Oracle consoles as network-key-backed local actions", () => {
    renderPlayarea({
      app_id: "miniapp-oracle-seal-console",
      name: "Oracle Seal Console",
      category: "utility",
      description: "Seal sensitive oracle payloads",
    });

    expect(screen.getByText("Privacy")).toBeVisible();
    expect(
      screen.getByText(
        "Morpheus public key is fetched from the selected network",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("Morpheus public key required"),
    ).not.toBeInTheDocument();
  });

  it("renders Forever Album as an actual uploader/gallery dApp, not a staged metadata preview", () => {
    renderPlayarea({
      app_id: "miniapp-forever-album",
      name: "Forever Album",
      category: "social",
      description: "Wallet-scoped photo vault",
      dapp_url: "/miniapps/forever-album/index.html",
      permissions: { storage: true },
    });

    expect(hasNativePlayArea("miniapp-forever-album")).toBe(true);
    expect(
      screen.queryByRole("heading", { name: "Forever Album · device memory album" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Focus workspace")).not.toBeInTheDocument();
    expect(screen.getByTitle("Forever Album local photo workspace")).toHaveAttribute(
      "src",
      expect.stringContaining("/miniapps/forever-album/index.html?"),
    );
    expect(screen.getByTitle("Forever Album local photo workspace")).toHaveAttribute(
      "sandbox",
      expect.stringContaining("allow-same-origin"),
    );
    expect(getNativePlayAreaOperationFallback("miniapp-forever-album")).toEqual([]);
    expect(screen.queryByText("Sign storage write")).not.toBeInTheDocument();
    expect(screen.queryByText("Stage album entry")).not.toBeInTheDocument();
    expect(screen.queryByText("Wallet album preview")).not.toBeInTheDocument();
  });

  it("opens Automation Copilot with its first-party host-session capability", () => {
    renderPlayarea({
      app_id: "miniapp-automation-copilot",
      name: "Automation Copilot",
      category: "data",
      description: "Visual automation recipe studio",
      dapp_url: "/miniapps/automation-copilot/index.html",
    });

    const frame = screen.getByTestId(
      "profiled-dapp-frame-miniapp-automation-copilot",
    );
    expect(frame).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
    );
    expect(screen.queryByText("Focus workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Enable automation")).not.toBeInTheDocument();
    expect(screen.queryByText("NEO price > 25")).not.toBeInTheDocument();
    expect(getNativePlayAreaOperationFallback("miniapp-automation-copilot")).toEqual([]);
  });

  it("opens Burn League through the embedded burn desk with amount presets", () => {
    const [operation] = getNativePlayAreaOperationFallback(
      "miniapp-burn-league",
      "testnet",
    );

    expect(operation).toMatchObject({
      name: "Prepare Burn Entry",
      method: "prepareMiniAppOperation",
      button_style: "danger",
      priority: "primary",
    });
    expect(operation.params).toEqual([
      expect.objectContaining({
        name: "amount",
        type: "amount",
        label: "Burn amount",
        default_value: "1",
        required: true,
        scale: 8,
      }),
    ]);
    expect(
      operation.params?.[0]?.presets?.map((preset) => preset.value),
    ).toEqual(["1", "5", "10"]);
  });

  it("builds the AA Market Hub action panel from the real create-listing inputs", () => {
    const [operation] = getNativePlayAreaOperationFallback(
      "miniapp-aa-market-hub",
      "testnet",
    );

    expect(operation).toEqual(
      expect.objectContaining({
        name: "Create listing",
        method: "prepareMiniAppOperation",
      }),
    );
    expect(operation.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "marketHash",
          type: "hash160",
          default_value: "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf",
          required: true,
        }),
        expect.objectContaining({
          name: "aaContractHash",
          type: "hash160",
          default_value: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
          required: true,
        }),
        expect.objectContaining({
          name: "accountIdHash",
          type: "hash160",
          required: true,
        }),
        expect.objectContaining({
          name: "priceGas",
          type: "amount",
          default_value: "18",
          required: true,
        }),
        expect.objectContaining({
          name: "listingTitle",
          default_value: "AA service package",
        }),
      ]),
    );
  });

  it("opens GasBox's real dApp draw console instead of advertising a fake host draw", () => {
    const [operation] = getNativePlayAreaOperationFallback(
      "miniapp-gasbox",
      "testnet",
    );

    expect(operation).toEqual(
      expect.objectContaining({
        name: "Open Draw Console",
        method: "prepareMiniAppOperation",
        description: expect.stringContaining("embedded GasBox draw surface"),
        button_style: "success",
      }),
    );
    expect(operation.params).toEqual([
      expect.objectContaining({
        name: "machineId",
        type: "string",
        label: "Machine ID",
      }),
    ]);
    expect(operation.params).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "draws" })]),
    );
  });

  it("keeps TrustAnchor focused on the user dApp iframe", () => {
    renderPlayarea({
      app_id: "miniapp-trustanchor",
      name: "TrustAnchor",
      category: "defi",
      description: "Manual 21-agent AA routing",
    });

    // TrustAnchor user surface now embeds the actual standalone dApp iframe
    // instead of templated stake/redeem/claim status rows. The dApp itself
    // is "specifically and carefully designed for the miniapp functionality."
    expect(
      screen.getByTestId("native-dapp-frame-miniapp-trustanchor"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Agent #1")).not.toBeInTheDocument();
  });

  it("renders Anchor admin consoles as their own dApp iframes", () => {
    renderPlayarea({
      app_id: "miniapp-profitanchor-admin",
      name: "ProfitAnchor Admin",
      category: "utility",
      description: "Operator manual routing",
    });

    expect(
      screen.getByTestId("native-dapp-frame-miniapp-profitanchor-admin"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Stake NEO")).not.toBeInTheDocument();
    expect(screen.queryByText("Claim GAS")).not.toBeInTheDocument();
  });

  it("presents an ended LastSurvivor round as rollover-ready instead of final", () => {
    render(
      <PlayAreaRegistry
        app={baseApp}
        stats={[
          { label: "Countdown", value: "Rollover Ready", accent: false },
          { label: "Prize Pool", value: "12.50 GAS", accent: true },
          { label: "Status", value: "Next Round Pending", accent: false },
        ]}
        statsMap={{
          Countdown: "Rollover Ready",
          "Prize Pool": "12.50 GAS",
          Status: "Next Round Pending",
          "Key Price": "0.05 GAS",
        }}
        activity={null}
        loading={false}
        error={null}
        contractHash="0x1234567890abcdef1234567890abcdef12345678"
        network="testnet"
        onRefresh={jest.fn()}
      />,
    );

    expect(screen.getByText("Next round is ready to start")).toBeVisible();
    // The LastSurvivor native play area now embeds the actual dApp iframe,
    // so the platform-side "Rollover Ready" status card no longer renders
    // (that status fact lives inside the dApp). The amber rollover banner
    // is the platform-side signal we still keep.
    expect(
      screen.getByTestId("native-dapp-frame-miniapp-last-survivor"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Round Ended")).not.toBeInTheDocument();
  });

  it("has a native playarea binding for every active MiniApp in the local catalog", () => {
    expect(ACTIVE_MINIAPP_IDS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(ACTIVE_MINIAPP_IDS).size).toBe(ACTIVE_MINIAPP_IDS.length);
    expect(
      ACTIVE_MINIAPP_IDS.filter((appId) => !hasNativePlayArea(appId)),
    ).toEqual([]);
  });

  it("keeps profiled MiniApps backed by their real standalone dApp surface", () => {
    expect(PROFILED_MINIAPP_MANIFESTS.length).toBeGreaterThanOrEqual(30);
  });

  it.each(
    PROFILED_MINIAPP_MANIFESTS.map(
      (manifest) => [manifest.appId, manifest] as const,
    ),
  )(
    "renders %s as a real dApp iframe instead of a status-only profile",
    (_appId, manifest) => {
      renderPlayarea({
        app_id: manifest.appId,
        name: manifest.name,
        category: manifest.category,
        description: manifest.description,
        entry_url: manifest.entryUrl,
        dapp_url: manifest.entryUrl,
      });

      expect(
        screen.getByTestId(`native-playarea-${manifest.appId}`),
      ).toBeVisible();
      // The dApp iframe IS the focal content — no "Live MiniApp workspace"
      // header banner sits above it. Just assert the iframe loads the dApp.
      expect(
        screen.getByTestId(`profiled-dapp-frame-${manifest.appId}`),
      ).toHaveAttribute("src", expect.stringContaining(manifest.entryUrl));
      expect(
        screen.queryByText("This MiniApp has no custom playarea profile yet"),
      ).not.toBeInTheDocument();
    },
  );

  it("keeps embedded MiniApps visually alive while the dApp iframe is loading", () => {
    jest.useFakeTimers();
    renderPlayarea({
      app_id: "miniapp-neo-swap",
      name: "Neo Swap",
      category: "defi",
      description: "Preview live pricefeed quotes before wallet submission",
    });

    const frame = screen.getByTestId("profiled-dapp-frame-miniapp-neo-swap");
    expect(frame).toHaveAttribute("loading", "eager");
    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-neo-swap-loading"),
    ).toBeVisible();
    expect(screen.getByText("Loading Neo Swap")).toBeVisible();

    fireEvent.load(frame);

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-neo-swap-loading"),
    ).toBeVisible();

    act(() => {
      jest.advanceTimersByTime(900);
    });

    expect(
      screen.queryByTestId("profiled-dapp-frame-miniapp-neo-swap-loading"),
    ).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it("gives Recovery Guardian enough embedded height for its full business workspace", () => {
    renderPlayarea({
      app_id: "miniapp-recovery-guardian",
      name: "Recovery Guardian",
      category: "utility",
      description:
        "Operator surface for AA guardian policy, recovery ticket flow, timelock review, and final recovery execution.",
    });

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-recovery-guardian"),
    ).toHaveClass("h-[3400px]", "sm:h-[2400px]", "lg:h-[1800px]");
  });

  it("gives Event Ticket Pass enough embedded height for organizer workflows", () => {
    renderPlayarea({
      app_id: "miniapp-event-ticket-pass",
      name: "Event Ticket Pass",
      category: "social",
      description:
        "Create events, issue attendee NEP-11 ticket passes, and operate door check-in through the platform OS services.",
    });

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-event-ticket-pass"),
    ).toHaveClass("h-[3300px]", "sm:h-[2300px]", "lg:h-[1800px]");
  });

  it("gives Quadratic Funding enough embedded height for round, project, and contribution workflows", () => {
    renderPlayarea({
      app_id: "miniapp-quadratic-funding",
      name: "Quadratic Funding",
      category: "defi",
      description:
        "Run public goods rounds with matching pools, project registration, and contributor funding flows.",
    });

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-quadratic-funding"),
    ).toHaveClass("h-[2200px]", "sm:h-[1800px]", "lg:h-[1600px]");
  });

  it("gives Soulbound Certificate enough embedded height for issuer and verifier workflows", () => {
    renderPlayarea({
      app_id: "miniapp-soulbound-certificate",
      name: "Soulbound Certificate",
      category: "social",
      description:
        "Issue non-transferable NEP-11 certificates, verify token IDs, and review issued credential state.",
    });

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-soulbound-certificate"),
    ).toHaveClass("h-[3000px]", "sm:h-[2200px]", "lg:h-[1600px]");
  });

  it("gives Unbreakable Vault enough embedded height for create, break, and recent vault workflows", () => {
    renderPlayarea({
      app_id: "miniapp-unbreakablevault",
      name: "Unbreakable Vault",
      category: "utility",
      description:
        "Create bounty vaults, test preimage claims, and review recent hash-locked vault state.",
    });

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-unbreakablevault"),
    ).toHaveClass("h-[1900px]", "sm:h-[1400px]", "lg:h-[1120px]");
  });

  it("gives Milestone Escrow enough embedded height for create, release, and evidence workflows", () => {
    renderPlayarea({
      app_id: "miniapp-milestone-escrow",
      name: "Milestone Escrow",
      category: "defi",
      description:
        "Create funded milestone escrows, approve work, claim released tranches, and inspect request/result evidence.",
    });

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-milestone-escrow"),
    ).toHaveClass("h-[2600px]", "sm:h-[2200px]", "lg:h-[1800px]");
  });

  it("gives NeoPay Shared Example enough embedded height for stream setup and lists", () => {
    renderPlayarea({
      app_id: "miniapp-neo-pay-shared-example",
      name: "NeoPay Shared Runtime",
      category: "defi",
      description:
        "Compose funding vault and payment stream modules through the shared MiniApp runtime.",
    });

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-neo-pay-shared-example"),
    ).toHaveClass("h-[1500px]", "sm:h-[1300px]", "lg:h-[1200px]");
  });

  it("gives LastSurvivor enough embedded height for countdown, buy, rules, and history", () => {
    renderPlayarea({
      app_id: "miniapp-last-survivor",
      name: "LastSurvivor",
      category: "gaming",
      description:
        "Buy keys, extend the countdown, and settle the prize pool through the live game surface.",
    });

    expect(
      screen.getByTestId("native-dapp-frame-miniapp-last-survivor"),
    ).toHaveClass("h-[2100px]", "sm:h-[1800px]", "lg:h-[1640px]");
  });

  it("gives Burn League enough embedded height for burn preview and leaderboard", () => {
    renderPlayarea({
      app_id: "miniapp-burn-league",
      name: "Burn League",
      category: "gaming",
      description:
        "Prepare a burn entry, review leaderboard impact, and submit the wallet intent.",
    });

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-burn-league"),
    ).toHaveClass("h-[1500px]", "sm:h-[1300px]", "lg:h-[1100px]");
  });

  it("uses the real stake-backed agreement profile for Breakup Contract", () => {
    renderPlayarea({
      app_id: "miniapp-breakupcontract",
      name: "Breakup Contract",
      category: "social",
      description:
        "Create stake-backed relationship agreements with partner signatures.",
    });

    expect(
      screen.queryByText("Stake-backed agreement desk"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-breakupcontract"),
    ).toBeVisible();
    fireEvent.click(screen.getByText("Activity and details"));
    expect(screen.getByText("Stake")).toBeInTheDocument();
    expect(screen.queryByText("Party A share")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-breakupcontract"),
    ).toHaveClass("h-[1700px]", "sm:h-[1450px]", "lg:h-[1180px]");
  });

  it("renders the real confidential-transfer privacy airlock instead of a duplicate host form", () => {
    expect(hasNativePlayArea("miniapp-private-transfer")).toBe(true);

    renderPlayarea({
      app_id: "miniapp-private-transfer",
      name: "Confidential Transfer",
      category: "defi",
      description: "Private transfer powered by Morpheus confidential compute",
      permissions: {
        confidential: true,
        datafeed: false,
        governance: false,
        payments: false,
        randomness: false,
        aa: false,
      },
    });

    expect(
      screen.getByRole("heading", { name: "Confidential transfer workspace" }),
    ).toBeVisible();
    const frame = screen.getByTestId("private-transfer-dapp-frame");
    expect(frame).toHaveAttribute(
      "src",
      "/miniapps/private-transfer/index.html?network=testnet&source=embed",
    );
    expect(frame).toHaveClass(
      "h-[1680px]",
      "sm:h-[1420px]",
      "lg:h-[1120px]",
    );
    expect(screen.queryByText("Recipient")).not.toBeInTheDocument();
    expect(screen.queryByText("Private memo")).not.toBeInTheDocument();
  });

  it("renders OneGate Vault as the current free Phaser game without stale chain diagnostics", () => {
    expect(hasNativePlayArea("miniapp-gas-lucky-pool")).toBe(true);

    render(
      <PlayAreaRegistry
        app={{
          ...baseApp,
          app_id: "miniapp-gas-lucky-pool",
          name: "OneGate Vault",
          category: "social",
          description:
            "A free local lucky-draw game with three prize tiers.",
          contracts: {},
          permissions: { payments: false, randomness: false },
        }}
        stats={[
          { label: "Status", value: "Active", accent: true },
          { label: "Asset", value: "GAS" },
          { label: "Claim Range", value: "1-50 GAS", accent: true },
        ]}
        statsMap={{
          Status: "Active",
          Asset: "GAS",
          "Claim Range": "1-50 GAS",
        }}
        activity={null}
        loading={false}
        error={null}
        contractHash="0x1234567890abcdef1234567890abcdef12345678"
        network="testnet"
        launchContext={{
          appId: "miniapp-gas-lucky-pool",
          source: "onegate",
          operation: "claimPool",
          tab: null,
          network: "testnet",
          params: {
            claimKey: "ogv_campaign_a_user_42",
            ref: "campaign-a",
          },
          keys: ["claimKey", "ref"],
          hasParams: true,
          signature: "claimKey=ogv_campaign_a_user_42&ref=campaign-a",
        }}
        onRefresh={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId("native-playarea-miniapp-gas-lucky-pool"),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "OneGate Vault" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Choose a prize tier, open the animated vault, and chase a better local score — free, with no wallet or GAS.",
      ),
    ).toBeVisible();
    // The OneGate Vault native play area now embeds the actual dApp iframe,
    // so the platform-side "Reward ready" / "Reward range" status cards no
    // longer render — those facts live inside the dApp itself.
    expect(
      screen.getByTestId("native-dapp-frame-miniapp-gas-lucky-pool"),
    ).toBeInTheDocument();
    expect(screen.queryByText("OneGate QR key")).not.toBeInTheDocument();
    expect(screen.queryByText("Single-use guard")).not.toBeInTheDocument();
    expect(screen.queryByText("Campaign setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Context and diagnostics")).not.toBeInTheDocument();
    expect(screen.queryByText("0x1234567890abcdef1234567890abcdef12345678")).not.toBeInTheDocument();
  });

  it("renders explorer as a real live search console instead of a static profiled preview", () => {
    renderPlayarea({
      app_id: "miniapp-explorer",
      name: "Explorer",
      category: "utility",
      description: "Search Neo blocks, transactions, addresses, and contracts",
    });

    expect(
      screen.getByRole("heading", { name: "Live explorer console" }),
    ).toBeVisible();
    expect(screen.getByText("Search state")).toBeVisible();
    expect(
      screen.getByText(
        /Enter the query and network, then inspect live chain results/i,
      ),
    ).toBeVisible();
    expect(screen.queryByText("Ready to submit")).not.toBeInTheDocument();
  });

  it.each([
    ["miniapp-aa-account-lab", "AA account registration lab"],
    ["miniapp-arrow-escape", "Garden Arrowworks board"],
    ["miniapp-bead-workshop", "Bead Workshop board"],
    ["miniapp-fruit-funnel", "Fruit Funnel orchard"],
    ["miniapp-gas-sponsor", "Gas sponsor policy desk"],
    ["miniapp-milestone-escrow", "Milestone escrow board"],
    ["miniapp-neo-multisig", "Multisig signing room"],
    ["miniapp-neo-swap", "Neo swap quote desk"],
    ["miniapp-wallet-health", "Wallet safety checkup"],
  ])("renders a profiled playarea for %s", (appId, heading) => {
    renderPlayarea({
      app_id: appId,
      name: heading,
      category: "utility",
      description: "Profiled MiniApp",
    });

    expect(screen.getByTestId(`native-playarea-${appId}`)).toBeVisible();
    expect(
      screen.getByTestId(`profiled-dapp-frame-${appId}`),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
    expect(screen.queryByText("Focus workspace")).not.toBeInTheDocument();
    expect(screen.getByText("Activity and details")).toBeVisible();
    expect(screen.getByText("Workflow")).not.toBeVisible();
    fireEvent.click(screen.getByText("Activity and details"));
    expect(screen.getByText("Workflow")).toBeVisible();
    expect(screen.queryByText("Ready to submit")).not.toBeInTheDocument();
  });

  it.each([
    ["miniapp-arrow-escape", "arrow-escape", "Garden Arrowworks board"],
    ["miniapp-bead-workshop", "bead-workshop", "Bead Workshop board"],
    ["miniapp-fruit-funnel", "fruit-funnel", "Fruit Funnel orchard"],
  ])(
    "keeps transaction-free guest app %s focused on its local runtime",
    (appId, slug, heading) => {
      const manifest = loadBundledManifest(slug);
      const app: MiniAppInfo = {
        ...baseApp,
        app_id: appId,
        name: heading,
        category: "gaming",
        entry_url: `/miniapps/${slug}/index.html`,
        contract_hash: null,
        contracts: {},
        operations: [],
        permissions: {},
        manifest,
      };

      expect(isChainRelevant(app)).toBe(false);
      renderPlayarea(app, {
        appId,
        source: "url",
        operation: "play",
        tab: null,
        network: null,
        params: { difficulty: "expert" },
        keys: ["difficulty"],
        hasParams: true,
        signature: "difficulty=expert",
      });

      expect(
        screen.queryByRole("heading", { name: heading }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Focus workspace")).not.toBeInTheDocument();
      expect(
        screen.getByTestId(`profiled-dapp-frame-${appId}`),
      ).toBeInTheDocument();
      expect(screen.queryByText("Live state")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("chain-technical-details"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Activity and details"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("URL launch parameters"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Workflow")).not.toBeInTheDocument();
    },
  );

  it("keeps a guest-only game local even when its manifest retains a historical testnet hash", () => {
    const manifest = loadBundledManifest("game-2048");
    const contracts = manifest.contracts as Record<string, unknown>;
    const app: MiniAppInfo = {
      ...baseApp,
      app_id: "miniapp-game-2048",
      name: "2048 strategy board",
      category: "gaming",
      entry_url: "/miniapps/game-2048/index.html",
      contract_hash: String(contracts["neo-n3-testnet"] ?? ""),
      contracts,
      operations: [],
      permissions: {},
      manifest,
    };

    expect(isChainRelevant(app)).toBe(false);
    renderPlayarea(app);

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-game-2048"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Slide illustrated building tiles, merge the kingdom upward, and resume the exact local board after a refresh.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Focus workspace")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/deterministic verification/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Live state")).not.toBeInTheDocument();
    expect(screen.queryByText("Activity and details")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chain-technical-details")).not.toBeInTheDocument();
  });

  it("does not turn a guest game into a wallet workflow for read-only chain access", () => {
    const manifest = loadBundledManifest("fogplay");
    const contracts = manifest.contracts as Record<string, unknown>;
    const app: MiniAppInfo = {
      ...baseApp,
      app_id: "miniapp-fogplay",
      name: "FogPlay",
      category: "gaming",
      entry_url: "/miniapps/fogplay/index.html",
      contract_hash: String(contracts["neo-n3-testnet"] ?? ""),
      contracts,
      operations: [],
      permissions: {},
      manifest,
    };

    expect(manifest.permissions).toEqual(["read:blockchain"]);
    expect(isChainRelevant(app)).toBe(false);
  });

  it("keeps the transactional Gas Sponsor profile on the chain-aware fallback path", () => {
    const manifest = loadBundledManifest("gas-sponsor");
    const app: MiniAppInfo = {
      ...baseApp,
      app_id: "miniapp-gas-sponsor",
      name: "Gas Sponsor",
      category: "utility",
      entry_url: "/miniapps/gas-sponsor/index.html",
      contract_hash: "0x31888679572bf2de61462ff9934b6265d60284f2",
      contracts: manifest.contracts as Record<string, unknown>,
      operations: [
        {
          name: "Enable sponsor policy",
          method: "enableSponsor",
          priority: "primary",
        },
      ],
      permissions: { payments: true },
      manifest,
    };

    expect(isChainRelevant(app)).toBe(true);
    renderPlayarea(app, {
      appId: app.app_id,
      source: "url",
      operation: "enableSponsor",
      tab: null,
      network: "testnet",
      params: { contract: "0x1234567890abcdef" },
      keys: ["contract"],
      hasParams: true,
      signature: "contract=0x1234567890abcdef",
    });

    expect(
      screen.getByTestId("profiled-dapp-frame-miniapp-gas-sponsor"),
    ).toBeInTheDocument();
    expect(screen.getByText("Live state")).toBeVisible();
    expect(screen.getByTestId("chain-technical-details")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Activity and details"));
    expect(screen.getByText("Sponsorship rules")).toBeVisible();
    expect(screen.getByText("Workflow")).toBeVisible();
    expect(screen.getByText("URL launch parameters")).toBeVisible();
  });

  it("uses scoped AA relay params in the profiled host fallback", () => {
    const [operation] = getNativePlayAreaOperationFallback(
      "miniapp-aa-relay-console",
      "testnet",
    );

    expect(operation?.name).toBe("Open relay workspace");
    expect(operation?.method).toBe("prepareMiniAppOperation");
    expect(operation?.params?.map((param) => param.name)).toEqual([
      "aaAddress",
      "dappId",
      "sponsorAmount",
      "payloadJson",
    ]);
    expect(
      operation?.params?.find((param) => param.name === "aaAddress"),
    ).toMatchObject({
      type: "address",
      required: true,
    });
    expect(
      operation?.params?.find((param) => param.name === "payloadJson")
        ?.default_value,
    ).toContain("0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2");

    const [mainnetOperation] = getNativePlayAreaOperationFallback(
      "miniapp-aa-relay-console",
      "mainnet",
    );
    expect(
      mainnetOperation?.params?.find((param) => param.name === "payloadJson")
        ?.default_value,
    ).toContain("0x0268a387913b250166ddec032b03332690a1ef78");
  });

  it("uses real AA account registration params in the profiled host fallback", () => {
    const [operation] = getNativePlayAreaOperationFallback(
      "miniapp-aa-account-lab",
      "testnet",
    );

    expect(operation?.name).toBe("Prepare account registration");
    expect(operation?.method).toBe("prepareMiniAppOperation");
    expect(operation?.params?.map((param) => param.name)).toEqual([
      "accountIdInput",
      "verifierHash",
      "verifierParamsHex",
      "hookHash",
      "backupOwner",
      "escapeTimelock",
    ]);
    expect(
      operation?.params?.find((param) => param.name === "accountIdInput"),
    ).toMatchObject({
      required: true,
    });
    expect(
      operation?.params?.find((param) => param.name === "verifierHash"),
    ).toMatchObject({
      type: "hash160",
      required: true,
    });
    expect(
      operation?.params?.find((param) => param.name === "backupOwner"),
    ).toMatchObject({
      type: "address",
      required: true,
    });
    expect(
      operation?.params?.find((param) => param.name === "escapeTimelock")
        ?.default_value,
    ).toBe("2592000");
  });

  it("uses real AA permission binding params in the profiled host fallback", () => {
    const [operation] = getNativePlayAreaOperationFallback(
      "miniapp-aa-permissions-lab",
      "testnet",
    );

    expect(operation?.name).toBe("Prepare permission update");
    expect(operation?.method).toBe("prepareMiniAppOperation");
    expect(operation?.params?.map((param) => param.name)).toEqual([
      "accountIdHash",
      "verifierHash",
      "verifierParamsHex",
      "hookHash",
    ]);
    expect(
      operation?.params?.find((param) => param.name === "accountIdHash"),
    ).toMatchObject({
      type: "hash160",
      required: true,
    });
    expect(
      operation?.params?.find((param) => param.name === "verifierHash"),
    ).toMatchObject({
      type: "hash160",
      default_value: "0x7147f9a508594a7656a25f45d0a7a7dede7c227f",
      required: true,
    });
    expect(
      operation?.params?.find((param) => param.name === "hookHash"),
    ).toMatchObject({
      type: "hash160",
    });
    expect(
      operation?.params?.find((param) => param.name === "hookHash")
        ?.default_value,
    ).not.toBe("spend-limit");
  });

  it("uses real AA session key params in the profiled host fallback", () => {
    const [operation] = getNativePlayAreaOperationFallback(
      "miniapp-aa-session-key-lab",
      "testnet",
    );

    expect(operation?.name).toBe("Open session key workspace");
    expect(operation?.method).toBe("prepareMiniAppOperation");
    expect(operation?.description).toContain("embedded MiniApp");
    expect(operation?.params?.map((param) => param.name)).toEqual([
      "accountSeed",
      "sessionPublicKey",
      "targetContract",
      "allowedMethod",
      "expiresAt",
      "dappId",
      "sponsorAmount",
    ]);
    expect(
      operation?.params?.find((param) => param.name === "accountSeed"),
    ).toMatchObject({
      default_value: "neo-aa-001",
      required: true,
    });
    expect(
      operation?.params?.find((param) => param.name === "targetContract"),
    ).toMatchObject({
      type: "hash160",
      // Self-contained MiniAppDailyCheckin (replaces the old kernel-era
      // 0xaba84da2…); resolved from the shared MINIAPP_CONTRACTS registry.
      default_value: "0x25db219a701a2b23130788723fcf9a2e76857235",
      required: true,
    });
    expect(
      operation?.params?.find((param) => param.name === "allowedMethod"),
    ).toMatchObject({
      default_value: "claimRewards",
      required: true,
    });
    expect(
      Number(
        operation?.params?.find((param) => param.name === "expiresAt")
          ?.default_value,
      ),
    ).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(
      operation?.params?.find((param) => param.name === "sponsorAmount"),
    ).toMatchObject({
      type: "amount",
      default_value: "0.1",
    });
    expect(
      operation?.params?.find((param) => param.name === "sessionPublicKey")
        ?.required,
    ).toBeUndefined();
  });

  it("does not duplicate Forever Album with a host operation form", () => {
    expect(
      getNativePlayAreaOperationFallback("miniapp-forever-album", "testnet"),
    ).toEqual([]);
  });

  it("does not duplicate Breakup Contract with a host operation form", () => {
    expect(
      getNativePlayAreaOperationFallback("miniapp-breakupcontract", "testnet"),
    ).toEqual([]);
  });

  it("exposes NeoPay stream actions as real wallet operations", () => {
    const operations = getNativePlayAreaOperationFallback(
      "miniapp-neo-pay",
      "testnet",
    );

    expect(operations.map((operation) => operation.name)).toEqual([
      "Create Stream",
      "Claim Stream",
      "Cancel Stream",
    ]);
    expect(operations.map((operation) => operation.method)).toEqual([
      "createStream",
      "claimStream",
      "cancelStream",
    ]);
    expect(operations[0]).toMatchObject({
      button_style: "primary",
      priority: "primary",
      confirm_message: "Create this payment stream on-chain?",
    });
    expect(operations[0]?.params?.map((param) => param.name)).toEqual([
      "creator",
      "beneficiary",
      "asset",
      "totalAmount",
      "rateAmount",
      "intervalSeconds",
      "title",
      "notes",
    ]);
    expect(
      operations[0]?.params?.find((param) => param.name === "creator"),
    ).toMatchObject({
      type: "hash160",
      default_value: "$wallet",
      hidden: true,
      required: true,
    });
    expect(
      operations[0]?.params?.find((param) => param.name === "beneficiary"),
    ).toMatchObject({
      type: "hash160",
      required: true,
    });
    expect(
      operations[0]?.params?.find((param) => param.name === "asset"),
    ).toMatchObject({
      type: "hash160",
      default_value: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      hidden: true,
      required: true,
    });
    expect(
      operations[0]?.params?.find((param) => param.name === "totalAmount"),
    ).toMatchObject({
      type: "amount",
      scale: 8,
      required: true,
      presets: [
        { label: "0.03", value: "0.03", helper: "GAS" },
        { label: "0.10", value: "0.10", helper: "GAS" },
        { label: "0.25", value: "0.25", helper: "GAS" },
      ],
    });
    expect(
      operations[0]?.params?.find((param) => param.name === "intervalSeconds"),
    ).toMatchObject({
      type: "integer",
      default_value: "86400",
      required: true,
    });
    expect(
      operations[1]?.params?.find((param) => param.name === "beneficiary"),
    ).toMatchObject({
      default_value: "$wallet",
      hidden: true,
      required: true,
    });
    expect(
      operations[2]?.params?.find((param) => param.name === "creator"),
    ).toMatchObject({
      default_value: "$wallet",
      hidden: true,
      required: true,
    });
  });

  it("exposes NeoPay Shared Runtime creation as a shared-module wallet operation", () => {
    const operations = getNativePlayAreaOperationFallback(
      "miniapp-neo-pay-shared-example",
      "testnet",
    );

    expect(operations.map((operation) => operation.method)).toEqual([
      "createSharedStream",
    ]);
    expect(operations[0]).toMatchObject({
      button_style: "primary",
      priority: "primary",
      confirm_message: "Create this shared-runtime payment stream on-chain?",
    });
    expect(operations[0]?.params?.map((param) => param.name)).toEqual([
      "beneficiary",
      "asset",
      "totalAmount",
      "rateAmount",
      "intervalSeconds",
      "title",
      "notes",
    ]);
    expect(
      operations[0]?.params?.find((param) => param.name === "asset"),
    ).toMatchObject({
      type: "hash160",
      default_value: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      hidden: true,
      required: true,
    });
    expect(
      operations[0]?.params?.find((param) => param.name === "totalAmount"),
    ).toMatchObject({
      type: "amount",
      scale: 8,
      required: true,
    });
  });

  it("renders On-chain Tarot through the real option-3 Phaser ritual", () => {
    renderPlayarea({
      app_id: "miniapp-onchaintarot",
      name: "On-chain Tarot",
      category: "gaming",
      description: "Tarot reading",
      entry_url: "/miniapps/on-chain-tarot/index.html",
    });

    expect(
      screen.getByRole("heading", { name: "On-chain Tarot ritual" }),
    ).toBeVisible();
    expect(screen.getByTestId("tarot-dapp-frame")).toHaveAttribute(
      "src",
      expect.stringContaining("/miniapps/on-chain-tarot/index.html"),
    );
    expect(
      screen.queryByText("0.1 GAS draw"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Neo on-chain draw")).not.toBeInTheDocument();
    expect(screen.queryByText("Draw again")).not.toBeInTheDocument();
  });

  it("renders tool miniapps as native consoles", () => {
    const bridgeView = renderPlayarea({
      app_id: "miniapp-neo-x-bridge",
      name: "Neo X Bridge",
      category: "defi",
      description: "Bridge console",
    });
    expect(screen.getByTestId("neo-x-bridge-dapp-frame")).toHaveAttribute(
      "src",
      expect.stringContaining("/miniapps/neo-x-bridge/index.html"),
    );
    expect(screen.queryByText("Target contract")).not.toBeInTheDocument();
    expect(screen.queryByText("Message Bridge")).not.toBeInTheDocument();
    bridgeView.unmount();

    renderPlayarea({
      app_id: "miniapp-oracle-http-console",
      name: "Oracle HTTP Console",
      category: "utility",
      description: "Oracle console",
    });
    expect(
      screen.getByRole("heading", { name: "HTTP Oracle Console" }),
    ).toBeVisible();
    expect(screen.getByText("Result verifier")).toBeVisible();
  });

  it("prefills native playareas from OneGate launch params", () => {
    render(
      <PlayAreaRegistry
        app={{
          ...baseApp,
          app_id: "miniapp-neo-x-bridge",
          name: "Neo X Bridge",
          category: "defi",
          description: "Bridge console",
        }}
        stats={[]}
        statsMap={{}}
        activity={null}
        loading={false}
        error={null}
        contractHash="0x1234567890abcdef1234567890abcdef12345678"
        network="testnet"
        launchContext={{
          appId: "miniapp-neo-x-bridge",
          source: "onegate",
          operation: "prepareAssetBridge",
          tab: null,
          network: "testnet",
          params: {
            amount: "3.5",
            direction: "Neo X -> Neo N3",
            recipient: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
          },
          keys: ["amount", "direction", "recipient"],
          hasParams: true,
          signature: "amount=3.5&direction=Neo%20X%20-%3E%20Neo%20N3",
        }}
        onRefresh={jest.fn()}
      />,
    );

    const frame = screen.getByTestId("neo-x-bridge-dapp-frame");
    expect(frame).toHaveAttribute(
      "src",
      expect.stringContaining("operation=prepareAssetBridge"),
    );
    expect(frame).toHaveAttribute(
      "src",
      expect.stringContaining("amount=3.5"),
    );
    expect(frame).toHaveAttribute(
      "src",
      expect.stringContaining("direction=Neo+X+-%3E+Neo+N3"),
    );
    expect(frame).toHaveAttribute(
      "src",
      expect.stringContaining("recipient=NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke"),
    );
  });
});
