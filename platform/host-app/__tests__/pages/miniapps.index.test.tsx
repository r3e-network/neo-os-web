import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import MiniAppsPage from "../../pages/miniapps/index";

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
      "/api/miniapps/catalog?network=mainnet",
      expect.any(Object),
    );
    await waitFor(() => {
      expect(screen.getByText("LastSurvivor")).toBeInTheDocument();
    });
  });
});
