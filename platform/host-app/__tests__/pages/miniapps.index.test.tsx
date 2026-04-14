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
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

jest.mock("../../components/features/miniapp", () => ({
  MiniAppGrid: ({ apps }: { apps: Array<{ app_id: string; name: string }> }) => (
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

  it("shows only flagship apps on the miniapps page", async () => {
    render(<MiniAppsPage />);

    await waitFor(() => {
      expect(screen.getByText("LastSurvivor")).toBeInTheDocument();
    });

    // Non-flagship apps should NOT appear on the flagship showcase page
    expect(screen.queryByText("On-Chain Tarot")).not.toBeInTheDocument();
  });
});
