/**
 * D1: the reference/diagnostics accordion is collapsed by default, so the
 * activity feed must not poll until the user opens it. We assert via the
 * `enabled` flag passed to useActivityFeed (which gates both the events/tx poll
 * and the realtime subscription).
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import MiniAppDetailPage from "../../pages/miniapps/[id]";

type ActivityFeedOptions = { enabled?: boolean; newsEnabled?: boolean };
const useActivityFeed = jest.fn((_opts?: ActivityFeedOptions) => ({
  activities: [] as never[],
  loading: false,
  error: null as string | null,
  isConnected: false,
  notifications: [] as never[],
  notificationsLoading: false,
  notificationsConnected: false,
}));
jest.mock("../../hooks/useActivityFeed", () => ({
  useActivityFeed: (opts: ActivityFeedOptions) => useActivityFeed(opts),
}));

jest.mock("../../components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));
jest.mock("../../components/AppDetailHeader", () => ({
  AppDetailHeader: () => <div />,
}));
jest.mock("../../components/MiniAppPlayfield", () => ({
  MiniAppPlayfield: () => <div />,
}));
jest.mock("../../components/OperationPanel", () => ({
  OperationPanel: () => <div />,
}));
jest.mock("../../components/features/reviews", () => ({
  ReviewsTab: () => <div />,
}));
jest.mock("../../components/features/forum", () => ({
  ForumTab: () => <div />,
}));
jest.mock("../../components/features/secrets/AppSecretsTab", () => ({
  AppSecretsTab: () => <div />,
}));
jest.mock("../../components/features/miniapp/DetailContentBlocks", () => ({
  DetailContentBlocks: () => <div />,
}));
jest.mock("../../lib/wallet/store", () => ({
  useWalletStore: jest.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      connected: false,
      address: "",
      network: null,
      loading: false,
      restorePending: false,
      refreshBalance: jest.fn(),
    };
    return typeof selector === "function" ? selector(state) : state;
  }),
  getWalletAdapter: jest.fn(),
}));
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    asPath: "/miniapps/miniapp-demo?network=testnet",
  }),
}));

function buildApp() {
  return {
    app_id: "miniapp-demo",
    name: "Demo App",
    description: "Demo description",
    icon: "D",
    category: "gaming",
    entry_url: "/miniapps/demo/index.html",
    permissions: { payments: true },
    contracts: { "neo-n3-testnet": "0x68ef0ead081d2263acc51ce82f5c70c46440cca4" },
    detail_template: {
      layout: "default",
      tabs: [{ id: "overview", label: "Overview", type: "content", blocks: [] }],
      operation_panel: { title: "Demo Actions", operations: [] },
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

describe("MiniAppDetailPage activity feed gating", () => {
  beforeEach(() => useActivityFeed.mockClear());

  it("does not enable the activity feed while the diagnostics accordion is collapsed", () => {
    renderDetailPage();
    const lastCall = useActivityFeed.mock.calls.at(-1)?.[0];
    expect(lastCall?.enabled).toBe(false);
    expect(lastCall?.newsEnabled).toBe(false);
  });

  it("enables the activity feed once the accordion is opened", () => {
    renderDetailPage();
    useActivityFeed.mockClear();

    const summary = screen.getByText("Reference and diagnostics");
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    // jsdom does not toggle <details> on summary click, so drive the open state
    // the same way a browser would, then fire the toggle event the page listens
    // for.
    (details as HTMLDetailsElement).open = true;
    fireEvent(details as HTMLDetailsElement, new Event("toggle"));

    const lastCall = useActivityFeed.mock.calls.at(-1)?.[0];
    expect(lastCall?.enabled).toBe(true);
    // Sanity: the summary heading is part of the accordion we toggled.
    expect(within(details as HTMLDetailsElement).getByText(
      "Reference and diagnostics",
    )).toBeInTheDocument();
  });
});
