import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "../Header";
import { Sidebar } from "../Sidebar";
import { ADMIN_NAVIGATION_ITEMS } from "@/lib/admin-navigation";

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

vi.mock("../../../../../shared/i18n/react", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "dashboard.title": "Admin Dashboard",
        "dashboard.overview": "Monitor and manage your MiniApp platform",
        "navigation.dashboard": "Dashboard",
        "navigation.services": "Services",
        "navigation.simulations": "Simulations",
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

vi.mock("../../../../../shared/i18n/LanguageSwitcher", () => ({
  LanguageToggle: () => <button>EN</button>,
}));

function getStaticTopLevelRoutes() {
  const appDir = path.resolve(process.cwd(), "src/app");
  return fs
    .readdirSync(appDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !entry.name.startsWith("(") && !entry.name.startsWith("_"))
    .filter((entry) => fs.existsSync(path.join(appDir, entry.name, "page.tsx")))
    .map((entry) => `/${entry.name}`)
    .sort();
}

describe("admin navigation contract", () => {
  it("keeps the shared admin navigation in sync with every static top-level page", () => {
    expect(ADMIN_NAVIGATION_ITEMS.map((item) => item.href).sort()).toEqual([
      "/",
      ...getStaticTopLevelRoutes(),
    ].sort());
  });

  it("renders the same navigation surface in desktop sidebar and mobile header", () => {
    const expectedNames = ADMIN_NAVIGATION_ITEMS.map((item) => item.labelFallback);

    render(<Sidebar />);
    for (const name of expectedNames) {
      expect(screen.getByRole("link", { name: new RegExp(name, "i") })).toHaveAttribute(
        "href",
        ADMIN_NAVIGATION_ITEMS.find((item) => item.labelFallback === name)?.href,
      );
    }

    document.body.innerHTML = "";

    render(<Header />);
    for (const name of expectedNames) {
      expect(screen.getByRole("link", { name: new RegExp(name, "i") })).toHaveAttribute(
        "href",
        ADMIN_NAVIGATION_ITEMS.find((item) => item.labelFallback === name)?.href,
      );
    }
  });
});
