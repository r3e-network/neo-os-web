import React from "react";
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  PlayAreaRegistry,
  getNativePlayAreaKind,
  getNativePlayAreaOperationFallback,
  hasNativePlayArea,
} from "../../components/playarea/PlayAreaRegistry";
import type { MiniAppInfo } from "../../components/types";

type LocalMiniAppManifest = {
  appId: string;
  name: string;
  description: string;
  category: string;
  entryUrl: string;
};

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
        category: manifest.category || "utility",
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

  it("renders Council Governance as a real proposal workspace, not a ballot placeholder", () => {
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
    expect(screen.getByText("Create, inspect, and vote")).toBeVisible();
    expect(screen.getByTitle("Council Governance dApp")).toHaveAttribute(
      "src",
      expect.stringContaining("/miniapps/council-governance/index.html?"),
    );
    expect(screen.getByText("Proposal queue")).toBeVisible();
    expect(screen.getByText("Total proposals")).toBeVisible();
    expect(screen.queryByText("Council ballot")).not.toBeInTheDocument();
    expect(screen.queryByText("Stage council vote")).not.toBeInTheDocument();
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
    expect(screen.getByText("Upload and view album")).toBeVisible();
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

  it("keeps TrustAnchor focused on user staking while folding routing diagnostics", () => {
    renderPlayarea({
      app_id: "miniapp-trustanchor",
      name: "TrustAnchor",
      category: "defi",
      description: "Manual 21-agent AA routing",
    });

    expect(screen.getByText("Stake NEO")).toBeVisible();
    expect(screen.getByText("Redeem NEO")).toBeVisible();
    expect(screen.getByText("Claim GAS")).toBeVisible();
    expect(screen.getByText("Operator route details")).toBeVisible();
    expect(screen.queryByText("Agent #1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Operator route details"));

    expect(screen.getByText("Registered agents")).toBeVisible();
    expect(screen.getByText("Selected manual route")).toBeVisible();
  });

  it("renders Anchor admin consoles as operator-only routing surfaces", () => {
    renderPlayarea({
      app_id: "miniapp-profitanchor-admin",
      name: "ProfitAnchor Admin",
      category: "utility",
      description: "Operator manual routing",
    });

    expect(screen.getByText("Move NEO")).toBeVisible();
    expect(screen.getByText("Update target")).toBeVisible();
    expect(screen.getByText("Sync vote")).toBeVisible();
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
    expect(screen.getAllByText("Rollover Ready").length).toBeGreaterThan(0);
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
      expect(screen.getByText("Live MiniApp workspace")).toBeVisible();
      expect(
        screen.getByTestId(`profiled-dapp-frame-${manifest.appId}`),
      ).toHaveAttribute("src", expect.stringContaining(manifest.entryUrl));
      expect(
        screen.queryByText("This MiniApp has no custom playarea profile yet"),
      ).not.toBeInTheDocument();
    },
  );

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
    expect(screen.getByText("Reward ready")).toBeVisible();
    expect(screen.getByText(/Your OneGate scan is verified/i)).toBeVisible();
    expect(screen.getByText("Reward range")).toBeVisible();
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
