import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { ConnectButton } from "@/components/features/wallet/ConnectButton";
import { useAuthStore } from "@/lib/auth/store";
import { useWalletStore } from "@/lib/wallet/store";
import { I18nProvider } from "@/lib/i18n/react";
import { LOCALE_STORAGE_KEY } from "@/lib/i18n";

jest.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: jest.fn(),
}));

jest.mock("@/lib/auth/store", () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseUser = useUser as jest.MockedFunction<typeof useUser>;
const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

function mockAuth(overrides: Record<string, unknown> = {}) {
  mockedUseAuthStore.mockReturnValue({
    walletAddress: "",
    loading: false,
    error: null,
    loginWallet: jest.fn(),
    loginWif: jest.fn(),
    loginSocial: jest.fn(),
    logout: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  });
}

describe("ConnectButton wallet choices", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedUseUser.mockReturnValue({
      user: undefined,
      error: undefined,
      isLoading: false,
      checkSession: jest.fn(),
    });
    mockAuth();
    useWalletStore.setState({
      connected: false,
      address: "",
      publicKey: "",
      network: null,
      provider: null,
      balance: null,
      loading: false,
      error: null,
    });
  });

  it("renders only real NEP-21 wallet choices", async () => {
    const user = userEvent.setup();
    render(<ConnectButton />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /log in \/ sign up/i }));
    });

    const onegate = screen.getByTestId("wallet-option-onegate");
    const neoline = screen.getByTestId("wallet-option-neoline");

    expect(
      within(onegate).getByAltText("OneGate").getAttribute("src"),
    ).toBe("/miniapps/gas-lucky-pool/onegate-logo.png");
    expect(
      within(neoline).getByAltText("NeoLine").getAttribute("src"),
    ).toBe("https://neoline.io/assets/images/home/neoline.svg");

    expect(within(onegate).getByText("Recommended")).toBeInTheDocument();
    expect(within(onegate).getByText("NEP-21")).toBeInTheDocument();
    expect(within(neoline).getByText("NEP-21")).toBeInTheDocument();
    expect(screen.queryByText("NEP-21 Wallet")).not.toBeInTheDocument();
    expect(screen.queryByText("O3 Wallet")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy dAPI")).not.toBeInTheDocument();
  });

  it("shows the connected wallet logo after connection", () => {
    useWalletStore.setState({
      connected: true,
      address: "Ncz1x2y3z4a5b6c7d8e9f0",
      publicKey: "03abc",
      network: "testnet",
      provider: "onegate",
      balance: { neo: "1", gas: "2.5" },
      loading: false,
      error: null,
    });

    render(<ConnectButton />);

    const icon = screen.getByAltText("OneGate wallet");
    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute("src")).toBe(
      "/miniapps/gas-lucky-pool/onegate-logo.png",
    );
    expect(screen.getByText("2.5 GAS")).toBeInTheDocument();
  });

  it("localizes the login and wallet picker modal in Chinese", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh");
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <ConnectButton />
      </I18nProvider>,
    );

    const loginButton = await screen.findByRole("button", {
      name: "登录 / 注册",
    });

    await act(async () => {
      await user.click(loginButton);
    });

    expect(await screen.findByText(/欢迎使用/)).toBeInTheDocument();
    expect(screen.getByText("邮箱与社交账号")).toBeInTheDocument();
    expect(screen.getByText("Neo 生态钱包")).toBeInTheDocument();

    const onegate = screen.getByTestId("wallet-option-onegate");
    const neoline = screen.getByTestId("wallet-option-neoline");
    expect(within(onegate).getByText("推荐")).toBeInTheDocument();
    expect(
      within(onegate).getByText("OneGate 钱包，Neo N3 合约调用通过 NEP-21 dAPI provider 执行。"),
    ).toBeInTheDocument();
    expect(within(neoline).getByText("NeoLine")).toBeInTheDocument();
    expect(screen.queryByText("NEP-21 钱包")).not.toBeInTheDocument();
    expect(screen.queryByText("O3 钱包")).not.toBeInTheDocument();
  });
});
