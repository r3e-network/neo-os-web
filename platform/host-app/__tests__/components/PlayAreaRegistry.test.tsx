import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  PlayAreaRegistry,
  hasNativePlayArea,
} from "../../components/playarea/PlayAreaRegistry";
import type { MiniAppInfo } from "../../components/types";

const ACTIVE_MINIAPP_IDS = [
  "miniapp-aa-account-lab",
  "miniapp-aa-market-hub",
  "miniapp-aa-permissions-lab",
  "miniapp-aa-relay-console",
  "miniapp-aa-session-key-lab",
  "miniapp-automation-copilot",
  "miniapp-breakupcontract",
  "miniapp-burn-league",
  "miniapp-council-governance",
  "miniapp-dailycheckin",
  "miniapp-dev-tipping",
  "miniapp-dicegame",
  "miniapp-event-ticket-pass",
  "miniapp-explorer",
  "miniapp-flashloan",
  "miniapp-fogplay",
  "miniapp-forever-album",
  "miniapp-gas-sponsor",
  "miniapp-gasbox",
  "miniapp-gov-merc",
  "miniapp-graveyard",
  "miniapp-last-survivor",
  "miniapp-memorial-shrine",
  "miniapp-milestone-escrow",
  "miniapp-neo-convert",
  "miniapp-neo-multisig",
  "miniapp-neo-ns",
  "miniapp-neo-pay",
  "miniapp-neo-pay-shared-example",
  "miniapp-neo-sign-anything",
  "miniapp-neo-treasury",
  "miniapp-neo-x-bridge",
  "miniapp-neodid-passport",
  "miniapp-onchaintarot",
  "miniapp-oracle-compute-lab",
  "miniapp-oracle-http-console",
  "miniapp-oracle-neodid-console",
  "miniapp-oracle-price-console",
  "miniapp-oracle-seal-console",
  "miniapp-oracle-vrf-console",
  "miniapp-profitanchor",
  "miniapp-quadratic-funding",
  "miniapp-recovery-guardian",
  "miniapp-redenvelope",
  "miniapp-secretvote",
  "miniapp-self-loan",
  "miniapp-soulbound-certificate",
  "miniapp-time-capsule",
  "miniapp-timestamp-proof",
  "miniapp-trustanchor",
  "miniapp-unbreakablevault",
  "miniapp-wallet-health",
];

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

  it("has a native playarea binding for every active MiniApp in the local catalog", () => {
    expect(ACTIVE_MINIAPP_IDS).toHaveLength(52);
    expect(ACTIVE_MINIAPP_IDS.filter((appId) => !hasNativePlayArea(appId))).toEqual([]);
  });

  it.each([
    ["miniapp-aa-account-lab", "AA account registration lab"],
    ["miniapp-dicegame", "Dice roll table"],
    ["miniapp-gas-sponsor", "Gas sponsor policy desk"],
    ["miniapp-milestone-escrow", "Milestone escrow board"],
    ["miniapp-neo-multisig", "Multisig signing room"],
    ["miniapp-secretvote", "Private ballot room"],
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
    expect(screen.getByText("Ready to submit")).toBeVisible();
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

    renderPlayarea({
      app_id: "miniapp-oracle-http-console",
      name: "Oracle HTTP Console",
      category: "utility",
      description: "Oracle console",
    });
    expect(screen.getByRole("heading", { name: "HTTP Oracle Console" })).toBeVisible();
    expect(screen.getByText("Result verifier")).toBeVisible();
  });
});
