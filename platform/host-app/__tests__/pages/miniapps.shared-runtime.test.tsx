import React from "react";
import { render, screen } from "@testing-library/react";
import MiniAppDetailPage, { getServerSideProps } from "../../pages/miniapps/[id]";

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
  MiniAppPlayfield: ({ launchContext }: { launchContext?: { params?: Record<string, string> } }) => (
    <div data-testid="playfield">{launchContext?.params?.amount || ""}</div>
  ),
}));

jest.mock("../../components/ActivityTicker", () => ({
  ActivityTicker: () => <div data-testid="activity-ticker" />,
}));

jest.mock("../../components/OperationPanel", () => ({
  OperationPanel: ({ launchContext }: { launchContext?: { params?: Record<string, string> } }) => (
    <div data-testid="operation-panel">{launchContext?.params?.amount || ""}</div>
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
  useActivityFeed: () => ({ activities: [] }),
}));

jest.mock("../../lib/wallet/store", () => ({
  useWalletStore: jest.fn((selector?: (state: any) => any) => {
    const state = { connected: false, address: "" };
    return typeof selector === "function" ? selector(state) : state;
  }),
  getWalletAdapter: jest.fn(),
}));

let mockAsPath = "/miniapps/miniapp-neo-pay-shared-example";

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), asPath: mockAsPath }),
}));

describe("MiniAppDetailPage shared runtime", () => {
  beforeEach(() => {
    mockAsPath = "/miniapps/miniapp-neo-pay-shared-example";
  });

  it("returns 404 for archived miniapp ids", async () => {
    const result = await getServerSideProps({
      params: { id: "miniapp-flamingo" },
      req: { headers: { host: "127.0.0.1:3000" } },
    } as any);

    expect(result).toEqual({ notFound: true });
  });

  it("redirects OneGate Vault launch URLs to the standalone dApp", async () => {
    const result = await getServerSideProps({
      params: { id: "miniapp-gas-lucky-pool" },
      req: {
        headers: { host: "127.0.0.1:3000" },
        url: "/miniapps/miniapp-gas-lucky-pool?key=ogv_user_42&pool=pool-001&network=testnet",
      },
    } as any);

    expect(result).toEqual({
      redirect: {
        destination:
          "/miniapps/gas-lucky-pool/index.html?key=ogv_user_42&pool=pool-001&network=testnet",
        permanent: false,
      },
    });
  });

  it("renders shared runtime bindings for shared-mode apps", () => {
    render(
      <MiniAppDetailPage
        app={{
          app_id: "miniapp-neo-pay-shared-example",
          name: "NeoPay Modular Fixture",
          description: "Shared mode app",
          icon: "🧩",
          category: "defi",
          entry_url: "mf://manifest?app=miniapp-neo-pay",
          permissions: { payments: true },
          contract_hash: null,
          detail_template: {
            layout: "default",
            tabs: [
              {
                id: "overview",
                label: "Overview",
                type: "content",
                blocks: [],
              },
            ],
            operation_panel: { title: "Create Shared Stream", operations: [] },
          },
          operations: [
            {
              name: "Create Stream",
              method: "createSharedStream",
              params: [],
            },
          ],
          manifest: {
            contract_composition: {
              mode: "shared",
              instance_id: "neopay:testnet:default",
            },
          },
        }}
        miniAppNav={[]}
        notifications={[]}
        sharedRuntime={{
          network: "testnet",
          registries: {
            moduleRegistry: "0x7666a46644dca58e8c3b308b34e83db440e04991",
            recipeRegistry: "0xe22bc8072f616974a64c0da1dfda845945d4215f",
            instanceRegistry: "0x5b9a6d1ca5fdbc95d4307990551682a3b7a1d5d6",
          },
          instance: {
            instanceId: "neopay:testnet:default",
            appId: "miniapp-neo-pay",
            recipeId: "recipe.payment_streams.v1",
            recipeVersion: "1.0.0",
            runtimeMode: "shared",
            ownerHash: "0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56",
            operatorHash: null,
            developerHash: "0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56",
            routerContractHash: null,
            moduleBindings: {
              vault: { module_id: "module.funding_vault", version: "1.0.0" },
              stream: { module_id: "module.stream_vesting", version: "1.0.0" },
            },
            configHash: "0xabc",
            frontendRef: "miniapp-neo-pay@2.0.0",
            status: 1,
            upgradePending: false,
            updatedAt: "2026-03-27T07:41:55.173Z",
          },
          recipe: {
            recipeId: "recipe.payment_streams.v1",
            version: "1.0.0",
            allowedRuntimeMode: "shared",
            routerTemplateId: null,
            active: true,
            moduleRefs: [],
            requiredFields: null,
            operationSchema: null,
            compatibilityMetadata: null,
          },
          modules: [
            {
              binding: "vault",
              moduleId: "module.funding_vault",
              version: "1.0.0",
              contractHash: "0x958bccb2ec9292461977ef1d2f1222d4e7861537",
              riskProfile: "custody",
              active: true,
              compatibilityMetadata: null,
            },
            {
              binding: "stream",
              moduleId: "module.stream_vesting",
              version: "1.0.0",
              contractHash: "0x4fa6544b133457b561e4f9db0248483eca3d33cf",
              riskProfile: "payments",
              active: true,
              compatibilityMetadata: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Shared Runtime")).toBeInTheDocument();
    expect(screen.getByText("neopay:testnet:default")).toBeInTheDocument();
    expect(
      screen.getByText("recipe.payment_streams.v1@1.0.0"),
    ).toBeInTheDocument();
    expect(screen.getByText("module.funding_vault@1.0.0")).toBeInTheDocument();
    expect(screen.getByText("module.stream_vesting@1.0.0")).toBeInTheDocument();
  });

  it("passes OneGate launch params to playfield and operation panel", () => {
    mockAsPath =
      "/miniapps/miniapp-neo-pay-shared-example?source=onegate&operation=createSharedStream&amount=12.5";

    render(
      <MiniAppDetailPage
        app={{
          app_id: "miniapp-neo-pay-shared-example",
          name: "NeoPay Modular Fixture",
          description: "Shared mode app",
          icon: "N",
          category: "defi",
          entry_url: "mf://manifest?app=miniapp-neo-pay",
          permissions: { payments: true },
          detail_template: {
            layout: "default",
            tabs: [{ id: "overview", label: "Overview", type: "content", blocks: [] }],
            operation_panel: {
              title: "Create Shared Stream",
              operations: [{ name: "Create Stream", method: "createSharedStream", params: [] }],
            },
          },
        }}
        miniAppNav={[]}
        notifications={[]}
        sharedRuntime={null}
      />,
    );

    expect(screen.getByTestId("playfield")).toHaveTextContent("12.5");
    expect(screen.getByTestId("operation-panel")).toHaveTextContent("12.5");
    expect(screen.getByTestId("mobile-action-dock")).toHaveTextContent(
      "Create Stream",
    );
    expect(screen.getByTestId("mobile-action-open")).toHaveAttribute(
      "aria-controls",
      "mobile-action-sheet",
    );
    expect(
      screen.getByTestId("operation-panel").compareDocumentPosition(
        screen.getByTestId("onegate-launch-card"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByTestId("onegate-launch-card").compareDocumentPosition(
        screen.getByTestId("launch-params-status"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId("onegate-qr-logo")).toBeInTheDocument();
    expect(screen.getByTestId("launch-params-status")).toHaveTextContent(
      "Launch parameters applied",
    );
    expect(screen.getByTestId("onegate-launch-url")).toHaveTextContent(
      "https://onegate.space/app/",
    );
    expect(screen.getByTestId("onegate-launch-url")).toHaveTextContent(
      "appId=miniapp-neo-pay-shared-example",
    );
  });

  it("uses the registered OneGate id while keeping the dApp entry standalone", () => {
    mockAsPath =
      "/miniapps/miniapp-gas-lucky-pool?key=ogv_user_42&pool=pool-001";

    render(
      <MiniAppDetailPage
        app={{
          app_id: "miniapp-gas-lucky-pool",
          name: "OneGate Vault",
          description: "Claim rewards",
          icon: "G",
          category: "social",
          entry_url: "/miniapps/gas-lucky-pool/index.html",
          dapp_url: "/miniapps/gas-lucky-pool/index.html",
          permissions: { payments: true },
          detail_template: {
            layout: "default",
            tabs: [{ id: "overview", label: "Overview", type: "content", blocks: [] }],
            operation_panel: {
              title: "Claim Reward",
              operations: [{ name: "Claim Reward", method: "claimOneGateVault", params: [] }],
            },
          },
          manifest: {
            onegate: {
              id: 23,
              standalone: true,
              url: "/miniapps/gas-lucky-pool/index.html",
            },
            urls: {
              entry: "/miniapps/gas-lucky-pool/index.html",
            },
          },
        }}
        miniAppNav={[]}
        notifications={[]}
        sharedRuntime={null}
      />,
    );

    expect(screen.getByTestId("onegate-launch-url")).toHaveTextContent(
      "https://onegate.space/app/23",
    );
    expect(screen.getByTestId("onegate-launch-url")).toHaveTextContent(
      "key=ogv_user_42",
    );
    expect(screen.getByTestId("onegate-launch-url")).toHaveTextContent(
      "pool=pool-001",
    );
    expect(screen.getByTestId("onegate-launch-url")).not.toHaveTextContent(
      "oneGateAppId=23",
    );
    expect(screen.getByTestId("onegate-launch-url")).not.toHaveTextContent(
      "operation=",
    );
    expect(screen.getByTestId("onegate-launch-url")).not.toHaveTextContent(
      "appId=",
    );
    expect(screen.getByTestId("onegate-launch-url")).not.toHaveTextContent(
      "/miniapps/miniapp-gas-lucky-pool",
    );
  });
});
