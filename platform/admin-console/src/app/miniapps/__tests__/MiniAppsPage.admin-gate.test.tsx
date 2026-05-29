import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MiniAppsPage from "../page";
import { createWrapper, mockFetchResponse } from "@/lib/__tests__/test-utils";

describe("MiniAppsPage admin access gate", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    });
  });

  it("does not fetch protected page data before an admin key is saved", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        return url.includes("live-smoke-reports")
          ? mockFetchResponse({ reports: [] })
          : mockFetchResponse([]);
      });

    render(<MiniAppsPage />, { wrapper: createWrapper() });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Admin key required")).toBeInTheDocument();
  });
});
