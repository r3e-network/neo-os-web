import React from "react";
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  PlayAreaRegistry,
  hasNativePlayArea,
} from "../../components/playarea/PlayAreaRegistry";
import type { MiniAppInfo } from "../../components/types";

function loadActiveMiniAppIds() {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const appsRoot = path.join(repoRoot, "apps");

  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(appsRoot, entry.name, "neo-manifest.json"))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .map((manifestPath) => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { app_id?: string; id?: string };
      return manifest.app_id || manifest.id;
    })
    .filter((appId): appId is string => Boolean(appId))
    .sort();
}

const ACTIVE_MINIAPP_IDS = loadActiveMiniAppIds();

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
    ["miniapp-redenvelope", "Lucky packet desk"],
    ["miniapp-dailycheckin", "Daily streak board"],
    ["miniapp-self-loan", "Self-repaying loan panel"],
    ["miniapp-profitanchor", "Profit route voting"],
    ["miniapp-trustanchor", "Trust route staking"],
    ["miniapp-neo-pay", "Payment stream builder"],
  ])("renders a native flagship playarea for %s", (appId, heading) => {
    renderPlayarea({ app_id: appId, name: heading, category: appId.includes("profit") ? "defi" : "gaming" });

    expect(screen.getByTestId(`native-playarea-${appId}`)).toBeVisible();
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
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
    expect(ACTIVE_MINIAPP_IDS.filter((appId) => !hasNativePlayArea(appId))).toEqual([]);
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

    expect(screen.getByRole("heading", { name: "Confidential transfer desk" })).toBeVisible();
    expect(screen.getAllByText("Morpheus confidential compute").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /seal private transfer/i })).toBeVisible();
    expect(screen.getByText("Recipient")).toBeVisible();
    expect(screen.getByText("Amount")).toBeVisible();
    expect(screen.getByText("Private memo")).toBeVisible();
    expect(screen.queryByText("N...recipient")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("private payment")).not.toBeInTheDocument();
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
          description: "Create a bounded GAS reward pool and let OneGate users scan to claim once.",
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

    expect(screen.getByTestId("native-playarea-miniapp-gas-lucky-pool")).toBeVisible();
    expect(screen.getByRole("heading", { name: "OneGate Vault" })).toBeVisible();
    expect(screen.getByText("Prefilled from scan parameters")).toBeVisible();
    expect(screen.getByText("OneGate QR key")).toBeVisible();
    expect(screen.getByText("Single-use guard")).toBeVisible();
  });

  it("renders explorer as a real live search console instead of a static profiled preview", () => {
    renderPlayarea({
      app_id: "miniapp-explorer",
      name: "Explorer",
      category: "utility",
      description: "Search Neo blocks, transactions, addresses, and contracts",
    });

    expect(screen.getByRole("heading", { name: "Live explorer console" })).toBeVisible();
    expect(screen.getByLabelText("Explorer query")).toBeVisible();
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

    expect(screen.getByRole("heading", { name: "Draw, flip, read" })).toBeVisible();
    await waitFor(() => expect(screen.getByText("3 cards")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /flip reading/i }));
    expect(screen.getAllByText(/The Fool|The Magician|The High Priestess/).length).toBeGreaterThan(0);
  });

  it("renders tool miniapps as native consoles", () => {
    renderPlayarea({
      app_id: "miniapp-neo-x-bridge",
      name: "Neo X Bridge",
      category: "defi",
      description: "Bridge console",
    });
    expect(screen.getByRole("heading", { name: "Neo X bridge control console" })).toBeVisible();
    expect(screen.getByText("Message Bridge")).toBeVisible();
    expect(screen.getByText("Target contract")).toBeVisible();
    expect(screen.getByText("Message")).toBeVisible();
    expect(screen.queryByDisplayValue("0xAxLabs...")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("sync:miniapp-state")).not.toBeInTheDocument();

    renderPlayarea({
      app_id: "miniapp-oracle-http-console",
      name: "Oracle HTTP Console",
      category: "utility",
      description: "Oracle console",
    });
    expect(screen.getByRole("heading", { name: "HTTP Oracle Console" })).toBeVisible();
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

    expect(screen.getByText("Amount")).toBeVisible();
    expect(screen.getByText("3.5")).toBeVisible();
    expect(screen.getByText("Target contract")).toBeVisible();
    expect(screen.getByText("0xabcdef")).toBeVisible();
    expect(screen.getByText("Message")).toBeVisible();
    expect(screen.getByText("sync state")).toBeVisible();
    expect(screen.getAllByText("Neo X -> Neo N3").length).toBeGreaterThan(0);
  });
});
