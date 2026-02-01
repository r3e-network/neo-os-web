import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MiniAppViewer } from "../../components/features/miniapp/MiniAppViewer";
import type { MiniAppInfo } from "../../components/types";
import { installMiniAppSDK } from "../../lib/miniapp-sdk";

const federatedSpy = jest.fn();

jest.mock("../../components/FederatedMiniApp", () => ({
  FederatedMiniApp: (props: unknown) => {
    federatedSpy(props);
    return <div data-testid="federated" />;
  },
}));

jest.mock("../../components/providers/ThemeProvider", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

jest.mock("../../components/features/miniapp/MiniAppLoader", () => ({
  MiniAppLoader: () => null,
}));

jest.mock("@/lib/wallet/store", () => ({
  useWalletStore: {
    subscribe: jest.fn(() => () => {}),
    getState: jest.fn(() => ({
      connected: false,
      address: null,
      balance: null,
      chainId: null,
      chainType: null,
    })),
  },
}));

jest.mock("@/lib/miniapp-sdk", () => ({
  installMiniAppSDK: jest.fn(() => ({
    getConfig: jest.fn(() => ({})),
  })),
}));

describe("MiniAppViewer", () => {
  beforeEach(() => {
    federatedSpy.mockClear();
    (installMiniAppSDK as jest.Mock).mockClear();
  });

  it("passes layout to federated miniapps", () => {
    const app: MiniAppInfo = {
      app_id: "test-app",
      name: "Test App",
      description: "Test description",
      icon: "🧩",
      category: "utility",
      entry_url: "mf://builtin?app=test-app",
      supportedChains: [],
      permissions: {},
      chainContracts: undefined,
    };

    render(<MiniAppViewer app={app} locale="en" />);

    expect(federatedSpy).toHaveBeenCalledWith(expect.objectContaining({ layout: "web" }));
  });

  it("passes resolved layout to SDK and federated apps", async () => {
    const app: MiniAppInfo = {
      app_id: "test-app",
      name: "Test App",
      description: "Test description",
      icon: "🧩",
      category: "utility",
      entry_url: "mf://builtin?app=test-app",
      supportedChains: [],
      permissions: {},
      chainContracts: undefined,
    };

    render(<MiniAppViewer app={app} locale="en" layout="mobile" />);

    await waitFor(() => {
      expect(installMiniAppSDK).toHaveBeenCalledWith(expect.objectContaining({ layout: "mobile" }));
      expect(federatedSpy).toHaveBeenCalledWith(expect.objectContaining({ layout: "mobile" }));
    });

  });
});
