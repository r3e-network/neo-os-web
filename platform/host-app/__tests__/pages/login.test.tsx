import { render, screen } from "@testing-library/react";
import LoginPage from "@/pages/login";
import { useAuthStore } from "@/lib/auth/store";

jest.mock("@/lib/auth/store", () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

describe("LoginPage", () => {
  beforeEach(() => {
    mockedUseAuthStore.mockReturnValue({
      loginSocial: jest.fn(),
      loginWallet: jest.fn(),
      loading: false,
      error: null,
      clearError: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders brand logos for Google and GitHub social login", () => {
    render(<LoginPage />);

    expect(screen.getByRole("button", { name: /continue with google/i })).toBeVisible();
    const githubButton = screen.getByRole("button", { name: /continue with github/i });
    expect(githubButton).toBeVisible();
    expect(githubButton).toHaveClass("bg-white");
    expect(githubButton).not.toHaveClass("bg-gray-900");
    expect(screen.getByTestId("oauth-google-logo")).toHaveAttribute(
      "src",
      "/brand/oauth-google.svg",
    );
    expect(screen.getByTestId("oauth-github-logo")).toHaveAttribute(
      "src",
      "/brand/oauth-github.svg",
    );
  });
});
