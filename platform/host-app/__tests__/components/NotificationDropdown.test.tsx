import { render, waitFor } from "@testing-library/react";
import { NotificationDropdown } from "@/components/features/notifications/NotificationDropdown";
import { useAuthStore } from "@/lib/auth/store";
import {
  fetchJSON,
  fetchOK,
  getWalletSessionToken,
} from "@/lib/fetch-client";

jest.mock("@/lib/auth/store", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/lib/fetch-client", () => ({
  fetchJSON: jest.fn(),
  fetchOK: jest.fn(),
  getWalletSessionToken: jest.fn(),
}));

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockedFetchJSON = fetchJSON as jest.MockedFunction<typeof fetchJSON>;
const mockedFetchOK = fetchOK as jest.MockedFunction<typeof fetchOK>;
const mockedGetWalletSessionToken =
  getWalletSessionToken as jest.MockedFunction<typeof getWalletSessionToken>;

describe("NotificationDropdown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ authenticated: true }),
    );
    mockedFetchJSON.mockResolvedValue({ events: [] });
    mockedFetchOK.mockResolvedValue(undefined);
  });

  it("does not call protected notification APIs without a wallet session token", async () => {
    mockedGetWalletSessionToken.mockReturnValue("");

    render(<NotificationDropdown walletAddress="NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu" />);

    await waitFor(() => {
      expect(mockedFetchJSON).not.toHaveBeenCalled();
    });
  });

  it("loads notifications when the authenticated wallet session token exists", async () => {
    mockedGetWalletSessionToken.mockReturnValue("wallet-session-jwt");

    render(<NotificationDropdown walletAddress="NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu" />);

    await waitFor(() => {
      expect(mockedFetchJSON).toHaveBeenCalledWith(
        "/api/notifications/events?wallet=NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu&limit=10",
      );
    });
  });

  it("keeps the dropdown constrained inside small viewports", () => {
    mockedGetWalletSessionToken.mockReturnValue("");

    const { container } = render(
      <NotificationDropdown walletAddress="NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu" />,
    );

    const panel = Array.from(container.querySelectorAll("[aria-hidden]")).find(
      (element) =>
        element.getAttribute("class")?.includes("backdrop-blur-2xl"),
    );
    const className = panel?.getAttribute("class") ?? "";
    expect(className).toContain("max-w-[calc(100vw-1.5rem)]");
    expect(className).toContain("max-sm:fixed");
    expect(className).toContain("max-sm:left-3");
    expect(className).toContain("max-sm:right-3");
  });
});
