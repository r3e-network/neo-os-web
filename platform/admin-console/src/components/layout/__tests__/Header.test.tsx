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

  it("keeps the header on the solid light operator-console chrome", () => {
    const { container } = render(<Header />);
    const header = screen.getByRole("banner");

    expect(header.className).toContain("bg-white");
    for (const token of [
      "dark:",
      "bg-white/95",
      "backdrop-blur",
      "rounded-md",
      "ring-neo",
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
