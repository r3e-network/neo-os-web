import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { MiniAppsTableCard } from "../MiniAppsTableCard";
import type { MiniApp } from "@/types";

const baseMiniApp: MiniApp = {
  app_id: "miniapp-aa-session-key-lab",
  developer_user_id: "operator",
  manifest_hash: "0xabc",
  entry_url: "/miniapps/aa-session-key-lab/index.html",
  developer_pubkey: "pubkey",
  permissions: { wallet: true, oracle: true, admin: false },
  limits: {},
  assets_allowed: [],
  governance_assets_allowed: [],
  manifest: {},
  status: "active",
  created_at: "2026-05-24T12:00:00.000Z",
  updated_at: "2026-05-24T12:00:00.000Z",
};

function renderTable(miniapps: MiniApp[] = [baseMiniApp]) {
  const props = {
    miniapps,
    isLoading: false,
    error: null,
    onEdit: vi.fn(),
    onClone: vi.fn(),
    onView: vi.fn(),
    onExport: vi.fn(),
    onToggleStatus: vi.fn(),
    onDisable: vi.fn(),
    statusPending: false,
    deletePending: false,
  };

  const renderResult = render(<MiniAppsTableCard {...props} />);
  return { ...props, ...renderResult };
}

describe("MiniAppsTableCard", () => {
  it("summarizes fleet health above the table", () => {
    renderTable([
      baseMiniApp,
      {
        ...baseMiniApp,
        app_id: "miniapp-oracle-price-console",
        status: "pending",
      },
      {
        ...baseMiniApp,
        app_id: "miniapp-aa-relay-console",
        status: "disabled",
      },
    ]);

    const summary = screen.getByLabelText("MiniApps table summary");
    expect(within(summary).getByText("Active")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Active MiniApps")).getByText("1"),
    ).toBeInTheDocument();
    expect(within(summary).getByText("Pending")).toBeInTheDocument();
    expect(within(summary).getByText("Disabled")).toBeInTheDocument();
  });

  it("groups row actions into primary and safety clusters", () => {
    renderTable();

    const actions = screen.getByLabelText(
      "MiniApp row actions for miniapp-aa-session-key-lab",
    );
    expect(within(actions).getByLabelText("Primary actions")).toBeInTheDocument();
    expect(within(actions).getByLabelText("Safety actions")).toBeInTheDocument();
    expect(
      within(actions).getByRole("button", { name: "Configure" }),
    ).toBeInTheDocument();
    expect(
      within(actions).getByRole("button", { name: "Disable" }),
    ).toBeInTheDocument();
    expect(
      within(actions).getByRole("button", { name: "Hide" }),
    ).toBeInTheDocument();
  });

  it("keeps the table workspace compact and light-themed", () => {
    const { container } = renderTable();

    const card = container.querySelector(".miniapps-table-card");
    expect(card).toBeInstanceOf(HTMLElement);
    expect((card as HTMLElement).className).toContain("rounded-xl");

    const actions = screen.getByLabelText(
      "MiniApp row actions for miniapp-aa-session-key-lab",
    );
    expect(actions.className).not.toContain("min-w-[34rem]");
    expect(actions.className).toContain("max-w-[28rem]");

    const primaryActions = within(actions).getByLabelText("Primary actions");
    expect(primaryActions.className).toContain("grid-cols-2");
    expect(primaryActions.className).toContain("sm:grid-cols-5");

    expect(container.innerHTML).not.toContain("dark:");
    expect(container.innerHTML).not.toContain("rounded-2xl");
    expect(container.innerHTML).not.toContain("bg-white/90");
    expect(container.innerHTML).not.toContain("backdrop-blur");
  });

  it("keeps the table source free of deprecated glass panel styling", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../MiniAppsTableCard.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/variant="glass"|glass-card|backdrop-blur/);
  });
});
