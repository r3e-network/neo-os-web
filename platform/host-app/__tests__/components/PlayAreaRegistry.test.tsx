import React from "react";
import fs from "fs";
import path from "path";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  PlayAreaRegistry,
  getNativePlayAreaKind,
  getNativePlayAreaOperationFallback,
  hasNativePlayArea,
} from "../../components/playarea/PlayAreaRegistry";
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

function normalizeMiniAppCategory(category: string | undefined): MiniAppCategory {
  const normalized = category?.trim() as MiniAppCategory | undefined;
  return normalized && MINIAPP_CATEGORIES.has(normalized) ? normalized : "utility";
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
    .filter(
      (manifest): manifest is LocalMiniAppManifest => Boolean(manifest),
    )
    .sort((left, right) => left.appId.localeCompare(right.appId));
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

function renderPlayarea(app: Partial<MiniAppInfo>) {
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
      launchContext={{
        appId: app.app_id ?? baseApp.app_id,
        source: "url",
        operation: null,
        tab: null,
        network: null,
        params: {},
        keys: [],
        hasParams: false,
        signature: "",
      }}
      onRefresh={jest.fn()}
    />,
  );
}

describe("PlayAreaRegistry", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    clearCouncilGovernanceClientCache();
    jest.clearAllMocks();
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
    expect(
      screen.getByText("Loading live governance proposals"),
    ).toBeVisible();
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
                candidate:
                  "0x8b915b5abcb81841face2afc42982c08a7e72b81",
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
    expect(
      screen.getByText(/profile names or logos/i),
    ).toBeVisible();
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
      screen.getByRole("heading", { name: "Forever Album photo vault" }),
    ).toBeVisible();
    expect(screen.getByText("Upload photos")).toBeVisible();
    expect(screen.getByText("View gallery")).toBeVisible();
    expect(
      screen.getByTitle("Forever Album uploader"),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("/miniapps/forever-album/index.html?"),
    );
    expect(getNativePlayAreaOperationFallback("miniapp-forever-album")).toEqual(
      [],
    );
    expect(screen.queryByText("Stage album entry")).not.toBeInTheDocument();
    expect(screen.queryByText("Wallet album preview")).not.toBeInTheDocument();
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
    PROFILED_MINIAPP_MANIFESTS.map((manifest) => [
      manifest.appId,
      manifest,
    ] as const),
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

  it("renders the confidential transfer miniapp as a Morpheus-backed private payment desk", () => {
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
        payments: true,
        randomness: false,
        aa: false,
      },
    });

    expect(
      screen.getByRole("heading", { name: "Confidential transfer desk" }),
    ).toBeVisible();
    expect(
      screen.getAllByText("Morpheus confidential compute").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /sealed locally for Morpheus confidential compute before submission/i,
      ),
    ).toBeVisible();
    expect(screen.getByText("Recipient")).toBeVisible();
    expect(screen.getByText("Amount")).toBeVisible();
    expect(screen.getByText("Private memo")).toBeVisible();
    expect(screen.queryByText("N...recipient")).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("private payment"),
    ).not.toBeInTheDocument();
  });

  it("renders OneGate Vault as a QR claim desk prefilled from OneGate launch params", () => {
    expect(hasNativePlayArea("miniapp-gas-lucky-pool")).toBe(true);

    render(
      <PlayAreaRegistry
        app={{
          ...baseApp,
          app_id: "miniapp-gas-lucky-pool",
          name: "OneGate Vault",
          category: "social",
          description:
            "Create a bounded GAS reward pool and let OneGate users scan to claim once.",
          permissions: { payments: true, randomness: true },
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
    // The OneGate Vault native play area now embeds the actual dApp iframe,
    // so the platform-side "Reward ready" / "Reward range" status cards no
    // longer render — those facts live inside the dApp itself.
    expect(
      screen.getByTestId("native-dapp-frame-miniapp-gas-lucky-pool"),
    ).toBeInTheDocument();
    expect(screen.queryByText("OneGate QR key")).not.toBeInTheDocument();
    expect(screen.queryByText("Single-use guard")).not.toBeInTheDocument();
    expect(screen.queryByText("Campaign setup")).not.toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    expect(screen.getByText("Activity and details")).toBeVisible();
    expect(screen.getByText("Workflow")).not.toBeVisible();
    fireEvent.click(screen.getByText("Activity and details"));
    expect(screen.getByText("Workflow")).toBeVisible();
    expect(screen.queryByText("Ready to submit")).not.toBeInTheDocument();
  });

  it("renders On-chain Tarot as a draw and flip table using the 78-card deck index", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 0,
            name: "The Fool",
            keyword: "Spark",
            meaning: "Leap",
            image: "./cards/00-the-fool.svg",
          },
          {
            id: 1,
            name: "The Magician",
            keyword: "Protocol",
            meaning: "Intent",
            image: "./cards/01-the-magician.svg",
          },
          {
            id: 2,
            name: "The High Priestess",
            keyword: "Oracle",
            meaning: "Signal",
            image: "./cards/02-the-high-priestess.svg",
          },
        ],
      } as Response),
    ) as typeof fetch;

    renderPlayarea({
      app_id: "miniapp-onchaintarot",
      name: "On-chain Tarot",
      category: "gaming",
      description: "Tarot reading",
    });

    expect(
      screen.getByRole("heading", { name: "Draw, flip, read" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByText("3 cards")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Past/i }));
    expect(
      screen.getAllByText(/The Fool|The Magician|The High Priestess/).length,
    ).toBeGreaterThan(0);
  });

  it("renders tool miniapps as native consoles", () => {
    const bridgeView = renderPlayarea({
      app_id: "miniapp-neo-x-bridge",
      name: "Neo X Bridge",
      category: "defi",
      description: "Bridge console",
    });
    expect(
      screen.getByRole("heading", { name: "Neo X bridge control console" }),
    ).toBeVisible();
    expect(screen.getAllByText(/Message Bridge/).length).toBeGreaterThan(0);
    expect(screen.getByText("Target contract")).toBeVisible();
    expect(screen.getByText("Message")).toBeVisible();
    expect(screen.queryByDisplayValue("0xAxLabs...")).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("sync:miniapp-state"),
    ).not.toBeInTheDocument();
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
    expect(screen.getByText("Result verifier")).not.toBeVisible();
    fireEvent.click(screen.getByText("Activity and details"));
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
          operation: "messageBridge",
          tab: null,
          network: "testnet",
          params: {
            amount: "3.5",
            direction: "Neo X -> Neo N3",
            targetContract: "0xabcdef",
            message: "sync state",
          },
          keys: ["amount", "direction", "targetContract", "message"],
          hasParams: true,
          signature: "amount=3.5&direction=Neo%20X%20-%3E%20Neo%20N3",
        }}
        onRefresh={jest.fn()}
      />,
    );

    expect(screen.getAllByText("3.5 GAS")[0]).toBeVisible();
    expect(screen.getByText("Target contract")).toBeVisible();
    expect(screen.getAllByText("0xabcdef").length).toBeGreaterThan(0);
    expect(screen.getByText("Message")).toBeVisible();
    expect(screen.getByText("sync state")).toBeVisible();
    expect(screen.getAllByText("Neo X -> Neo N3").length).toBeGreaterThan(0);
    expect(screen.getByText("Additional metrics")).toBeVisible();
    expect(screen.getByText("Amount")).not.toBeVisible();
    fireEvent.click(screen.getByText("Additional metrics"));
    expect(screen.getByText("Amount")).toBeVisible();
  });
});
