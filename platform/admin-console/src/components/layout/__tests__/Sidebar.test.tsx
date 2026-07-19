// =============================================================================
// Sidebar Component Tests
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock i18n - return the last segment of the key as readable text
vi.mock("../../../../../shared/i18n/react", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "navigation.dashboard": "Dashboard",
        "navigation.services": "Services",
        "navigation.miniapps": "MiniApps",
        "navigation.templateStudio": "Template Studio",
        "navigation.users": "Users",
        "navigation.analytics": "Analytics",
        "navigation.contracts": "Contracts",
        // Mirrors the real en locale (shared/i18n/locales/en/admin.json) so the
        // brand heading stays distinguishable from the static "Admin Console"
        // eyebrow label rendered below it.
        "dashboard.title": "Admin Dashboard",
      };
      return map[key] ?? key;
    },
    locale: "en",
    setLocale: () => {},
  }),
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: () => {},
  }),
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Sidebar Component", () => {
  it("should render sidebar", () => {
    render(<Sidebar />);
    // Neo v3 brand block: translated product title plus static eyebrow label.
    expect(
      screen.getByRole("heading", { name: "Admin Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Admin Console")).toBeInTheDocument();
  });

  it("should render all navigation items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("MiniApps")).toBeInTheDocument();
    expect(screen.getByText("Template Studio")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Contracts")).toBeInTheDocument();
  });

  it("should render navigation links with correct hrefs", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Dashboard/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: /Services/i })).toHaveAttribute(
      "href",
      "/services",
    );
    expect(screen.getByRole("link", { name: /MiniApps/i })).toHaveAttribute(
      "href",
      "/miniapps",
    );
    expect(
      screen.getByRole("link", { name: /Template Studio/i }),
    ).toHaveAttribute("href", "/templates");
    expect(screen.getByRole("link", { name: /Users/i })).toHaveAttribute(
      "href",
      "/users",
    );
    expect(screen.getByRole("link", { name: /Analytics/i })).toHaveAttribute(
      "href",
      "/analytics",
    );
    expect(screen.getByRole("link", { name: /Contracts/i })).toHaveAttribute(
      "href",
      "/contracts",
    );
  });

  it("should display version info", () => {
    render(<Sidebar />);
    expect(screen.getByText("Neo Platform")).toBeInTheDocument();
    // The footer version is derived from package.json so the label can never
    // drift from the shipped package version again (the Neo v3 restyle had
    // hardcoded a "v3.0.0" design-iteration number that matched no release).
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });

  it("should mark active link with aria-current", () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("should have correct sidebar width", () => {
    const { container } = render(<Sidebar />);
    const sidebar = container.firstChild;
    expect(sidebar).toHaveClass("w-64");
  });

  it("keeps the sidebar restrained and aligned with the light admin shell", () => {
    // Re-pinned 2026-07-15 to the committed Neo v3 shell (488fa04ec): the
    // sidebar sits on the shared light `surface` token, the brand tile and
    // active nav state use flat `neo` accents (`bg-neo-600` / `bg-neo-50`),
    // uppercase micro-labels use `tracking-wider`, and links carry
    // `focus-visible:ring-neo-500/40` focus rings — so `bg-neo`,
    // `tracking-wider`, and `ring-neo` left the ban list as deliberate
    // conventions. Guard intent is unchanged: no dark-mode styling, no
    // gradients, no oversized radii, and no arbitrary shadow values.
    const { container } = render(<Sidebar />);
    const sidebar = container.firstChild as HTMLElement;

    expect(sidebar).toHaveClass("bg-surface");
    for (const token of [
      "dark:",
      "glass-card",
      "bg-gradient",
      "rounded-2xl",
      "shadow-[",
    ]) {
      expect(container.innerHTML, `sidebar should not include ${token}`).not.toContain(
        token,
      );
    }
  });
});
