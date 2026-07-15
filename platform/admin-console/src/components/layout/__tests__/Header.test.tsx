// =============================================================================
// Header Component Tests
// =============================================================================

import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { Header } from "../Header";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

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

// Mock i18n
vi.mock("../../../../../shared/i18n/react", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "dashboard.title": "Admin Dashboard",
        "dashboard.overview": "Monitor and manage your MiniApp platform",
        "navigation.dashboard": "Dashboard",
        "navigation.services": "Services",
        "navigation.miniapps": "MiniApps",
        "navigation.templateStudio": "Template Studio",
        "navigation.users": "Users",
        "navigation.analytics": "Analytics",
        "navigation.contracts": "Contracts",
      };
      return map[key] ?? key;
    },
    locale: "en",
    setLocale: () => {},
  }),
}));

// Mock LanguageSwitcher
vi.mock("../../../../../shared/i18n/LanguageSwitcher", () => ({
  LanguageToggle: () => <button>EN</button>,
}));

describe("Header Component", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("should render header", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("should display title", () => {
    render(<Header />);
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("should display subtitle", () => {
    render(<Header />);
    expect(
      screen.getByText("Monitor and manage your MiniApp platform"),
    ).toBeInTheDocument();
  });

  it("uses the active route label and concise section context", () => {
    vi.mocked(usePathname).mockReturnValue("/miniapps");

    render(<Header />);

    expect(
      screen.getByRole("heading", { name: "MiniApps" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Registry and publish control")).toBeInTheDocument();
  });

  it("should display environment indicator", () => {
    render(<Header />);
    expect(screen.getByText("Local Development")).toBeInTheDocument();
  });

  it("should have sticky positioning class", () => {
    render(<Header />);
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("sticky");
    expect(header).toHaveClass("top-0");
  });

  it("keeps the header on the light operator-console chrome", () => {
    // Re-pinned 2026-07-15 to the committed Neo v3 shell (488fa04ec): the
    // header now sits on the shared light `surface` token with a translucent
    // sticky treatment (`bg-surface/80 backdrop-blur-xl`), and interactive
    // items carry brand focus rings (`focus-visible:ring-neo-500/40`) for
    // keyboard accessibility — so `backdrop-blur` and `ring-neo` left the ban
    // list. Guard intent is unchanged: no dark-mode chrome, no gradients, and
    // no heavy legacy shadows on the operator console shell.
    const { container } = render(<Header />);
    const header = screen.getByRole("banner");

    expect(header.className).toContain("bg-surface");
    for (const token of [
      "dark:",
      "bg-black",
      "glass-card",
      "bg-gradient",
      "rounded-md",
      "shadow-lg",
    ]) {
      expect(container.innerHTML, `header should not include ${token}`).not.toContain(
        token,
      );
      expect(header.className, `header shell should not include ${token}`).not.toContain(
        token,
      );
    }
  });
});
