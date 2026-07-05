import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionRail } from "../components-react/v2";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

describe("ActionRail", () => {
  it("keeps one secondary action visible as a quiet support chip", () => {
    render(
      <ActionRail
        primary={{ label: "Mint", onClick: vi.fn() }}
        secondary={[{ label: "Preview", onClick: vi.fn() }]}
      />,
    );

    expect(screen.getByRole("button", { name: "Mint" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("keeps two secondary actions visible for common wallet follow-ups", () => {
    render(
      <ActionRail
        primary={{ label: "Copy report", onClick: vi.fn() }}
        secondary={[
          { label: "Refresh", onClick: vi.fn() },
          { label: "Copy address", onClick: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy report" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy address" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("groups three or more secondary actions so the rail keeps a single primary focus", () => {
    render(
      <ActionRail
        primary={{ label: "Start game", onClick: vi.fn() }}
        secondary={[
          { label: "Withdraw", onClick: vi.fn() },
          { label: "Refresh", onClick: vi.fn() },
          { label: "Export", onClick: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Start game" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();

    const more = screen.getByRole("button", { name: "More actions" });
    expect(more.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(more);

    expect(more.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu", { name: "More actions" });
    expect(
      within(menu).getByRole("menuitem", { name: "Withdraw" }),
    ).toBeTruthy();
    expect(
      within(menu).getByRole("menuitem", { name: "Refresh" }),
    ).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Export" })).toBeTruthy();
  });

  it("runs a grouped secondary action and closes the support menu", () => {
    const onWithdraw = vi.fn();
    render(
      <ActionRail
        primary={{ label: "Roll", onClick: vi.fn() }}
        secondary={[
          { label: "Withdraw", onClick: onWithdraw },
          { label: "Refresh", onClick: vi.fn() },
          { label: "Export", onClick: vi.fn() },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Withdraw" }));

    expect(onWithdraw).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu", { name: "More actions" })).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "More actions" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
});
