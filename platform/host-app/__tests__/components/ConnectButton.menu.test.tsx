import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { ConnectButton } from "@/components/features/wallet/ConnectButton";
import { useAuthStore } from "@/lib/auth/store";
import { useWalletStore } from "@/lib/wallet/store";

jest.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: jest.fn(),
}));

jest.mock("@/lib/auth/store", () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseUser = useUser as jest.MockedFunction<typeof useUser>;
const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

const ADDRESS = "NConnectedAddress1234567890abc";

function mockAuth(overrides: Record<string, unknown> = {}) {
  const auth = {
    walletAddress: "",
    loading: false,
    error: null,
    loginWallet: jest.fn(),
    loginWif: jest.fn(),
    loginSocial: jest.fn(),
    logout: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  };
  mockedUseAuthStore.mockReturnValue(auth);
  return auth;
}

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

describe("ConnectButton connected chip menu", () => {
  let writeText: jest.Mock;

  beforeEach(() => {
    window.localStorage.clear();
    mockedUseUser.mockReturnValue({
      user: undefined,
      error: undefined,
      isLoading: false,
      checkSession: jest.fn(),
    });
    mockAuth();
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    setWalletState({
      connected: true,
      address: ADDRESS,
      publicKey: "03abc",
      network: "testnet",
      provider: "onegate",
      balance: { neo: "1", gas: "2.5" },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("opens a real menu from the connected chip", () => {
    render(<ConnectButton />);

    expect(screen.queryByTestId("wallet-chip-menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wallet-chip"));

    const menu = screen.getByTestId("wallet-chip-menu");
    expect(menu).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /copy address/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /view on explorer/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /account settings/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /disconnect/i }),
    ).toBeInTheDocument();
  });

  it("copies the address and shows success feedback", async () => {
    render(<ConnectButton />);

    fireEvent.click(screen.getByTestId("wallet-chip"));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy address/i }));

    expect(writeText).toHaveBeenCalledWith(ADDRESS);
    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });

  it("links to the network-aware explorer address page", () => {
    render(<ConnectButton />);

    fireEvent.click(screen.getByTestId("wallet-chip"));
    const explorerLink = screen.getByRole("menuitem", {
      name: /view on explorer/i,
    });
    expect(explorerLink).toHaveAttribute(
      "href",
      `https://dora.coz.io/address/neo3/testnet/${ADDRESS}`,
    );
    expect(explorerLink).toHaveAttribute("target", "_blank");
  });

  it("links to the account page", () => {
    render(<ConnectButton />);

    fireEvent.click(screen.getByTestId("wallet-chip"));
    expect(
      screen.getByRole("menuitem", { name: /account settings/i }),
    ).toHaveAttribute("href", "/account");
  });

  it("offers disconnect from the menu behind the existing confirmation", () => {
    render(<ConnectButton />);

    fireEvent.click(screen.getByTestId("wallet-chip"));
    fireEvent.click(screen.getByRole("menuitem", { name: /disconnect/i }));

    expect(
      screen.getByText("You'll need to reconnect to use blockchain features."),
    ).toBeInTheDocument();
  });
});

describe("ConnectButton pending session resume chip", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedUseUser.mockReturnValue({
      user: undefined,
      error: undefined,
      isLoading: false,
      checkSession: jest.fn(),
    });
    setWalletState({
      restorePending: true,
      address: ADDRESS,
      provider: "onegate",
      network: "testnet",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("resumes the persisted session with one click", () => {
    const auth = mockAuth();
    render(<ConnectButton />);

    const chip = screen.getByTestId("wallet-resume-chip");
    expect(chip).toHaveTextContent("Reconnect");
    fireEvent.click(chip);

    expect(auth.loginWallet).toHaveBeenCalledWith("onegate");
  });

  it("can dismiss the saved session and fall back to the login button", () => {
    mockAuth();
    render(<ConnectButton />);

    fireEvent.click(
      screen.getByRole("button", { name: /dismiss saved wallet session/i }),
    );

    expect(screen.queryByTestId("wallet-resume-chip")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log in \/ sign up/i }),
    ).toBeInTheDocument();
  });
});
