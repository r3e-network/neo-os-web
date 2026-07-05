import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import AccountPage from "@/pages/account";
import { useWalletStore } from "@/lib/wallet/store";
import { I18nProvider } from "@/lib/i18n/react";
import { LOCALE_STORAGE_KEY } from "@/lib/i18n";

jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/layout", () => {
  const actual = jest.requireActual("@/components/layout");
  return {
    ...actual,
    Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

const ADDRESS = "NAccountPageAddress1234567890ab";

function setWalletState(overrides: Record<string, unknown> = {}) {
  useWalletStore.setState({
    connected: false,
    address: "",
    publicKey: "",
    network: null,
    provider: null,
    balance: null,
    loading: false,
    error: null,
    restorePending: false,
    ...overrides,
  });
}

describe("AccountPage", () => {
  let writeText: jest.Mock;

  beforeEach(() => {
    window.localStorage.clear();
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    setWalletState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("tells the truth when no wallet is connected", () => {
    render(<AccountPage />);

    // Hero stat + wallet card badge + access summary row all stay honest.
    expect(screen.getAllByText("Not connected").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    // Em-dash placeholder instead of an address.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /copy/i })).toBeDisabled();
  });

  it("does not treat a restore-pending saved wallet address as connected", () => {
    setWalletState({
      connected: false,
      address: ADDRESS,
      provider: "onegate",
      network: "testnet",
      restorePending: true,
    });

    render(<AccountPage />);

    expect(screen.getAllByText("Not connected").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /copy/i })).toBeDisabled();
  });

  it("uses the brand product name in the page title", () => {
    render(<AccountPage />);

    expect(
      screen.getByText("Profile Settings - Neo Miniapps"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Account - Neo")).not.toBeInTheDocument();
  });

  it("shows connected state and gives clipboard feedback after copy", async () => {
    setWalletState({
      connected: true,
      address: ADDRESS,
      provider: "onegate",
      network: "mainnet",
    });

    render(<AccountPage />);

    expect(screen.getAllByText("Connected").length).toBeGreaterThanOrEqual(2);
    const copyButton = screen.getByRole("button", { name: /copy/i });
    expect(copyButton).toBeEnabled();

    fireEvent.click(copyButton);
    expect(writeText).toHaveBeenCalledWith(ADDRESS);
    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });

  it("avoids internal pipeline language in the stats note", () => {
    render(<AccountPage />);

    expect(
      screen.queryByText(/data pipeline/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("renders through the host locale (Chinese)", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh");

    render(
      <I18nProvider>
        <AccountPage />
      </I18nProvider>,
    );

    expect(await screen.findByText("个人资料设置")).toBeInTheDocument();
    expect(screen.getAllByText("未连接").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("安全提示")).toBeInTheDocument();
  });
});
