import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAccessKeyPanel } from "../AdminAccessKeyPanel";
import { ADMIN_API_KEY_STORAGE_KEY } from "@/lib/admin-client";

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <AdminAccessKeyPanel />
    </QueryClientProvider>,
  );

  return { ...renderResult, invalidateSpy };
}

describe("AdminAccessKeyPanel", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("shows the required state when no admin key is stored", () => {
    renderPanel();

    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByLabelText("Admin API key")).toHaveAttribute(
      "placeholder",
      "Paste admin key",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("uses the same compact light admin chrome as the MiniApps workspace", () => {
    const { container } = renderPanel();
    const panel = container.querySelector(".admin-access-key-panel");

    expect(panel).toBeInstanceOf(HTMLElement);
    expect((panel as HTMLElement).className).toContain("rounded-xl");

    for (const token of [
      "dark:",
      "bg-white/95",
      "backdrop-blur",
      "disabled:opacity-50",
      "tracking-[",
    ]) {
      expect(container.innerHTML, `admin access should not include ${token}`).not.toContain(
        token,
      );
    }
  });

  it("stores a trimmed key and switches to the active state", () => {
    const { invalidateSpy } = renderPanel();

    fireEvent.change(screen.getByLabelText("Admin API key"), {
      target: { value: "  local-admin-key  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(window.sessionStorage.getItem(ADMIN_API_KEY_STORAGE_KEY)).toBe(
      "local-admin-key",
    );
    expect(screen.getByText("Active for this tab")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("clears an existing admin key", () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "local-admin-key");
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(window.sessionStorage.getItem(ADMIN_API_KEY_STORAGE_KEY)).toBeNull();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
});
