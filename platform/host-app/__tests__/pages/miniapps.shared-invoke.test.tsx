import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MiniAppDetailPage from "../../pages/miniapps/[id]";

const mockPush = jest.fn();
const mockInvoke = jest.fn();
let mockWalletState = {
  connected: true,
  address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
  network: "testnet" as "testnet" | "mainnet" | null,
};

jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush }),
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

jest.mock("../../components/ActivityTicker", () => ({
  ActivityTicker: () => <div data-testid="activity-ticker" />,
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
    return typeof selector === "function"
      ? selector(mockWalletState)
      : mockWalletState;
  }),
  getWalletAdapter: jest.fn(() => ({
    invoke: mockInvoke,
  })),
}));

describe("MiniAppDetailPage shared invoke", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ txid: "0xsharedtx" });
    mockWalletState = {
      connected: true,
      address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
      network: "testnet",
    };
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "testnet";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK;
  });

  it("invokes the shared module contract using operation recipes", async () => {
    render(
      <MiniAppDetailPage
        app={{
          app_id: "miniapp-neo-pay-shared-example",
          name: "NeoPay Modular Fixture",
          description: "Shared mode app",
          icon: "🧩",
          category: "defi",
          entry_url: "mf://manifest?app=miniapp-neo-pay",
          contract_hash: null,
          permissions: { payments: true },
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
              params: [
                {
                  name: "beneficiary",
                  type: "address",
                  label: "Beneficiary Address",
                  required: true,
                },
                {
                  name: "asset",
                  type: "select",
                  label: "Asset",
                  required: true,
                  default_value: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
                  options: [
                    {
                      label: "GAS",
                      value: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
                    },
                  ],
                },
                {
                  name: "totalAmount",
                  type: "amount",
                  label: "Total Amount",
                  required: true,
                },
                {
                  name: "rateAmount",
                  type: "amount",
                  label: "Release Per Interval",
                  required: true,
                },
                {
                  name: "intervalSeconds",
                  type: "select",
                  label: "Interval",
                  required: true,
                  default_value: "2592000",
                  options: [{ label: "Monthly", value: "2592000" }],
                },
                {
                  name: "title",
                  type: "string",
                  label: "Stream Name",
                  required: true,
                },
                {
                  name: "notes",
                  type: "string",
                  label: "Notes",
                  required: false,
                },
              ],
            },
          ],
          manifest: {
            contract_composition: {
              mode: "shared",
              instance_id: "neopay:testnet:default",
            },
            frontend_composition: {
              operation_recipes: [
                {
                  operation: "createSharedStream",
                  binding: "stream",
                  method: "createStream",
                  args: [
                    { source: "instance.instanceId", type: "String" },
                    { source: "wallet.address", type: "Hash160" },
                    { source: "input.beneficiary", type: "Hash160" },
                    { source: "input.asset", type: "Hash160" },
                    { source: "input.totalAmount", type: "Integer", scale: 8 },
                    { source: "input.rateAmount", type: "Integer", scale: 8 },
                    { source: "input.intervalSeconds", type: "Integer" },
                    { source: "input.title", type: "String" },
                    { source: "input.notes", type: "String" },
                  ],
                },
              ],
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
            ownerHash: null,
            operatorHash: null,
            developerHash: null,
            routerContractHash: null,
            moduleBindings: {
              stream: { module_id: "module.stream_vesting", version: "1.0.0" },
              vault: { module_id: "module.funding_vault", version: "1.0.0" },
            },
            configHash: null,
            frontendRef: "miniapp-neo-pay@2.0.0",
            status: 1,
            upgradePending: false,
            updatedAt: null,
          },
          recipe: null,
          modules: [
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

    fireEvent.change(screen.getByLabelText("Beneficiary Address"), {
      target: { value: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX" },
    });
    fireEvent.change(screen.getByLabelText("Total Amount"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("Release Per Interval"), {
      target: { value: "1.5" },
    });
    fireEvent.change(screen.getByLabelText("Stream Name"), {
      target: { value: "Monthly payroll stream" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Optional context" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Stream" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith({
        scriptHash: "0x4fa6544b133457b561e4f9db0248483eca3d33cf",
        operation: "createStream",
        args: [
          { type: "String", value: "neopay:testnet:default" },
          {
            type: "Hash160",
            value: "0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56",
          },
          {
            type: "Hash160",
            value: "0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56",
          },
          {
            type: "Hash160",
            value: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
          },
          { type: "Integer", value: "2000000000" },
          { type: "Integer", value: "150000000" },
          { type: "Integer", value: "2592000" },
          { type: "String", value: "Monthly payroll stream" },
          { type: "String", value: "Optional context" },
        ],
        signers: [{ account: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX", scopes: 1 }],
      });
    });
  });

  it("invokes a platform runtime contract with the hidden appId argument", async () => {
    render(
      <MiniAppDetailPage
        app={{
          app_id: "miniapp-last-survivor",
          name: "Last Survivor",
          description: "Platform game",
          icon: "timer",
          category: "gaming",
          entry_url: "mf://manifest?app=miniapp-last-survivor",
          contract_hash: "0xlegacydedicated0000000000000000000000000000",
          permissions: { payments: true },
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
            operation_panel: { title: "Play", operations: [] },
          },
          operations: [
            {
              name: "Buy Keys",
              method: "buyCountdownKeys",
              params: [
                {
                  name: "player",
                  type: "hash160",
                  label: "Player",
                  required: true,
                  default_value: "$wallet",
                  hidden: true,
                },
                {
                  name: "keyCount",
                  type: "integer",
                  label: "Keys",
                  required: true,
                },
              ],
            },
          ],
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
                    },
                  },
                },
              ],
            },
          },
        }}
        miniAppNav={[]}
        notifications={[]}
        sharedRuntime={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Keys"), {
      target: { value: "3" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Buy Keys" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith({
        scriptHash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
        operation: "buyCountdownKeys",
        args: [
          { type: "String", value: "miniapp-last-survivor" },
          { type: "Hash160", value: "0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56" },
          { type: "Integer", value: "3" },
        ],
        signers: [{ account: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX", scopes: 1 }],
      });
    });
  });
});
