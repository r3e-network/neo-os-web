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
  MiniAppPlayfield: () => <div data-testid="playfield" />,
}));

jest.mock("../../components/ActivityTicker", () => ({
  ActivityTicker: () => <div data-testid="activity-ticker" />,
}));

jest.mock("../../components/OperationPanel", () => ({
  OperationPanel: () => <div data-testid="operation-panel" />,
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

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("MiniAppDetailPage shared runtime", () => {
  it("returns 404 for archived miniapp ids", async () => {
    const result = await getServerSideProps({
      params: { id: "miniapp-flamingo" },
      req: { headers: { host: "127.0.0.1:3000" } },
    } as any);

    expect(result).toEqual({ notFound: true });
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
});
