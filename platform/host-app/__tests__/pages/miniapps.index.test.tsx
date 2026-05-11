import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import MiniAppsPage from "../../pages/miniapps/index";
import { I18nProvider } from "@/lib/i18n/react";
import { LOCALE_STORAGE_KEY } from "@/lib/i18n";

jest.mock("next/router", () => ({
  useRouter: jest.fn(() => ({
    query: {},
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    pathname: "/miniapps",
  })),
}));

jest.mock("../../components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

jest.mock("../../components/features/miniapp", () => ({
  MiniAppGrid: ({
    apps,
  }: {
    apps: Array<{ app_id: string; name: string }>;
  }) => (
    <div data-testid="miniapp-grid">
      {apps.map((app) => (
        <div key={app.app_id}>{app.name}</div>
      ))}
    </div>
  ),
}));

jest.mock("../../components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

describe("MiniAppsPage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/miniapps/catalog")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            apps: [
              {
                app_id: "miniapp-last-survivor",
                name: "LastSurvivor",
                description: "flagship",
                category: "gaming",
                entry_url: "mf://manifest?app=miniapp-last-survivor",
              },
              {
                app_id: "miniapp-on-chain-tarot",
                name: "On-Chain Tarot",
                description: "non-flagship catalog app",
                category: "utility",
                entry_url: "mf://manifest?app=miniapp-on-chain-tarot",
              },
            ],
          }),
        } as Response);
      }

      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      } as Response);
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it("shows all catalog miniapps as cards", async () => {
    render(<MiniAppsPage />);

    await waitFor(() => {
      expect(screen.getByText("LastSurvivor")).toBeInTheDocument();
    });

    expect(screen.getByText("On-Chain Tarot")).toBeInTheDocument();
  });

  it("renders bundled MiniApp props immediately before the catalog refresh completes", async () => {
    render(
      <MiniAppsPage
        initialApps={[
          {
            app_id: "miniapp-gasbox",
            name: "GasBox",
            description: "bundled flagship",
            icon: "G",
            category: "gaming",
            entry_url: "mf://manifest?app=miniapp-gasbox",
            permissions: {},
          },
          {
            app_id: "miniapp-on-chain-tarot",
            name: "On-Chain Tarot",
            description: "non-flagship bundled app",
            icon: "T",
            category: "utility",
            entry_url: "mf://manifest?app=miniapp-on-chain-tarot",
            permissions: {},
          },
        ]}
      />,
    );

    expect(screen.getByText("GasBox")).toBeInTheDocument();
    expect(screen.getByText("On-Chain Tarot")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/miniapps/catalog?scope=all",
      expect.any(Object),
    );
    await waitFor(() => {
      expect(screen.getByText("LastSurvivor")).toBeInTheDocument();
    });
  });

  it("localizes the catalog shell and MiniApp cards when the stored locale is Chinese", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh");
    global.fetch = jest.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;

    render(
      <I18nProvider>
        <MiniAppsPage
          initialApps={[
            {
              app_id: "miniapp-last-survivor",
              name: "Last Survivor",
              name_zh: "最后生还者",
              description: "Last clicker wins the pool.",
              description_zh: "最后按下按钮的人赢得奖池。",
              icon: "L",
              category: "gaming",
              category_name_zh: "游戏",
              entry_url: "mf://manifest?app=miniapp-last-survivor",
              permissions: {},
              manifest: {
                i18n: {
                  name_zh: "最后生还者",
                  description_zh: "最后按下按钮的人赢得奖池。",
                },
                category_name_zh: "游戏",
                contracts: { mainnet: "0x123" },
              },
            },
          ]}
        />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "义乌小程序" })).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("按名称、分类或应用 ID 搜索")).toBeInTheDocument();
    expect(screen.getByText("最后生还者")).toBeInTheDocument();
    expect(screen.getByText("最后按下按钮的人赢得奖池。")).toBeInTheDocument();
    expect(screen.getAllByText("已上线").length).toBeGreaterThan(0);
    expect(screen.getByText("打开小程序")).toBeInTheDocument();
  });
});
