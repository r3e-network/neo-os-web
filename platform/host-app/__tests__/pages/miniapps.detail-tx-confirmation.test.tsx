import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import MiniAppDetailPage from "../../pages/miniapps/[id]";
import { HOST_WALLET_BRIDGE_RESULT } from "../../components/playarea/PlayAreaShared";

// Authoritative confirmation reads the application log; mock it so we can drive
// HALT (confirmed) vs FAULT (failed) without touching the network.
const getApplicationLog = jest.fn();
jest.mock("../../lib/chain/rpc-client", () => ({
  getApplicationLog: (...args: unknown[]) => getApplicationLog(...args),
}));

jest.mock("../../components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

jest.mock("../../components/AppDetailHeader", () => ({
  AppDetailHeader: ({ app }: { app: { name: string } }) => (
    <div data-testid="detail-header">{app.name}</div>
  ),
}));

jest.mock("../../components/MiniAppPlayfield", () => ({
  MiniAppPlayfield: () => <div data-testid="playfield" />,
}));

jest.mock("../../components/OperationPanel", () => ({
  OperationPanel: ({
    operations = [],
  }: {
    operations?: Array<{ name?: string; method?: string }>;
  }) => (
    <div data-testid="operation-panel">
      {operations.map((operation) => (
        <span key={`${operation.method}:${operation.name}`}>
          {operation.name}
        </span>
      ))}
    </div>
  ),
}));

jest.mock("../../components/features/reviews", () => ({
  ReviewsTab: () => <div data-testid="reviews-tab" />,
}));

jest.mock("../../components/features/forum", () => ({
  ForumTab: () => <div data-testid="forum-tab" />,
}));

jest.mock("../../components/features/secrets/AppSecretsTab", () => ({
  AppSecretsTab: () => <div data-testid="secrets-tab" />,
}));

jest.mock("../../components/features/miniapp/DetailContentBlocks", () => ({
  DetailContentBlocks: () => <div data-testid="detail-content-blocks" />,
}));

jest.mock("../../hooks/useActivityFeed", () => ({
  useActivityFeed: () => ({
    activities: [],
    notifications: [],
    notificationsLoading: false,
    notificationsConnected: false,
  }),
}));

const walletState = {
  connected: false,
  address: "",
  network: null as string | null,
  loading: false,
  restorePending: false,
  refreshBalance: jest.fn(),
};

jest.mock("../../lib/wallet/store", () => ({
  useWalletStore: jest.fn((selector?: (state: unknown) => unknown) =>
    typeof selector === "function" ? selector(walletState) : walletState,
  ),
  getWalletAdapter: jest.fn(),
}));

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    asPath: "/miniapps/miniapp-demo?network=testnet",
  }),
}));

const CONTRACT_HASH = "0x68ef0ead081d2263acc51ce82f5c70c46440cca4";
const TXID =
  "0x9f53a363fa1f0536b5112c31ad28295799319984730477432c6d6e63f0c7c7aa";

function buildApp() {
  return {
    app_id: "miniapp-demo",
    name: "Demo App",
    description: "Demo description",
    icon: "D",
    category: "gaming",
    entry_url: "/miniapps/demo/index.html",
    permissions: { payments: true },
    contracts: { "neo-n3-testnet": CONTRACT_HASH },
    detail_template: {
      layout: "default",
      tabs: [{ id: "overview", label: "Overview", type: "content", blocks: [] }],
      operation_panel: {
        title: "Demo Actions",
        operations: [
          { name: "Create Envelope", method: "createEnvelope", params: [] },
        ],
      },
    },
  };
}

function renderDetailPage() {
  return render(
    <MiniAppDetailPage
      app={buildApp() as never}
      initialTargetNetwork="testnet"
      miniAppNav={[]}
      notifications={[]}
      sharedRuntime={null}
    />,
  );
}

function emitSubmission() {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(HOST_WALLET_BRIDGE_RESULT, {
        detail: {
          appId: "miniapp-demo",
          network: "testnet",
          requestMethod: "invoke",
          txid: TXID,
          operation: "createEnvelope",
          contractHash: CONTRACT_HASH,
          memo: "",
          at: new Date().toISOString(),
        },
      }),
    );
  });
}

describe("MiniAppDetailPage transaction confirmation (vmstate)", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    getApplicationLog.mockReset();
    // The page only runs the confirmation poll when a fetch implementation is
    // present (jsdom has none by default). getApplicationLog is mocked, so this
    // stub is never actually invoked — it only satisfies the capability gate.
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("confirms the receipt only once the application log reports HALT", async () => {
    getApplicationLog.mockResolvedValue({ executions: [{ vmstate: "HALT" }] });
    renderDetailPage();
    emitSubmission();

    await waitFor(() =>
      expect(screen.getAllByText(/confirmed/i).length).toBeGreaterThan(0),
    );
    expect(getApplicationLog).toHaveBeenCalledWith(TXID, "testnet");
  });

  it("marks the receipt as failed when the application log reports FAULT", async () => {
    getApplicationLog.mockResolvedValue({ executions: [{ vmstate: "FAULT" }] });
    renderDetailPage();
    emitSubmission();

    await waitFor(() =>
      expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0),
    );
    // The reverted tx must not be shown as a neutral success message.
    await waitFor(() =>
      expect(
        screen.getAllByText(/reverted on-chain/i).length,
      ).toBeGreaterThan(0),
    );
  });
});

describe("MiniAppDetailPage action console restoring state", () => {
  afterEach(() => {
    walletState.loading = false;
    walletState.restorePending = false;
  });

  it("shows a neutral 'Checking wallet…' state while a persisted session restores", () => {
    walletState.restorePending = true;
    renderDetailPage();

    expect(screen.getAllByText(/checking wallet/i).length).toBeGreaterThan(0);
    // It must not claim the wallet is required during the restore window.
    expect(screen.queryByText("Wallet Required")).not.toBeInTheDocument();
  });
});
