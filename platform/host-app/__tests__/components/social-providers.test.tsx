import { fireEvent, render, screen } from "@testing-library/react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { ConnectButton } from "@/components/features/wallet/ConnectButton";
import { socialLoginProviders } from "@/components/features/wallet/social-providers";
import LoginPage from "@/pages/login";
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

function mockAuth() {
  const auth = {
    walletAddress: "",
    loading: false,
    error: null,
    loginWallet: jest.fn(),
    loginWif: jest.fn(),
    loginSocial: jest.fn(),
    logout: jest.fn(),
    clearError: jest.fn(),
  };
  mockedUseAuthStore.mockReturnValue(auth);
  return auth;
}

describe("shared social login providers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedUseUser.mockReturnValue({
      user: undefined,
      error: undefined,
      isLoading: false,
      checkSession: jest.fn(),
    });
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
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("exposes the full provider set supported by the social login API", () => {
    expect(socialLoginProviders.map((p) => p.id)).toEqual([
      "google",
      "twitter",
      "github",
    ]);
  });

  it("renders the same provider set on the /login page", () => {
    const auth = mockAuth();
    render(<LoginPage />);

    for (const provider of socialLoginProviders) {
      const button = screen.getByRole("button", {
        name: new RegExp(`continue with ${provider.name}`, "i"),
      });
      fireEvent.click(button);
      expect(auth.loginSocial).toHaveBeenCalledWith(provider.id);
    }
    expect(auth.loginSocial).toHaveBeenCalledTimes(socialLoginProviders.length);
  });

  it("renders the same provider set in the connect modal", () => {
    const auth = mockAuth();
    render(<ConnectButton />);

    fireEvent.click(screen.getByRole("button", { name: /log in \/ sign up/i }));

    for (const provider of socialLoginProviders) {
      const button = screen.getByRole("button", {
        name: new RegExp(`continue with ${provider.name}`, "i"),
      });
      fireEvent.click(button);
      expect(auth.loginSocial).toHaveBeenCalledWith(provider.id);
      expect(screen.getByTestId(`oauth-${provider.id}-logo`)).toHaveAttribute(
        "src",
        provider.iconSrc,
      );
    }
    expect(auth.loginSocial).toHaveBeenCalledTimes(socialLoginProviders.length);
  });
});
