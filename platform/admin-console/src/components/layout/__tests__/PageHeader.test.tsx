import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "../PageHeader";

describe("PageHeader", () => {
  it("renders shared route titles and actions", () => {
    render(
      <PageHeader
        title="Price Feeds"
        description="Oracle feed health"
        actions={<button type="button">Refresh</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Price Feeds" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Oracle feed health")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("keeps shared route headers compact, light, and free of glow effects", () => {
    // Re-pinned 2026-07-15 to the committed Neo v3 shell (488fa04ec):
    // `highlightLastWord` now paints the highlighted word with the brand ink
    // token (`text-neo-600`), so `text-neo` left the ban list — it is a flat
    // brand accent, not a glow. Guard intent is unchanged: compact heading
    // scale (no `text-3xl`), no dark-mode styling, no drop shadows, and no
    // arbitrary letter-spacing hacks.
    const { container } = render(
      <PageHeader
        title="Oracle Secrets"
        description="Credential operations"
        highlightLastWord
      />,
    );

    const header = container.querySelector(".admin-page-header");
    expect(header).toBeInstanceOf(HTMLElement);
    expect((header as HTMLElement).className).toContain("gap-2");

    const heading = container.querySelector("h1");
    expect(heading).toBeInstanceOf(HTMLElement);
    expect((heading as HTMLElement).className).toContain("text-xl");
    expect((heading as HTMLElement).className).toContain("text-ink");

    for (const token of [
      "dark:",
      "drop-shadow",
      "text-3xl",
      "tracking-[",
    ]) {
      expect(container.innerHTML, `page header should not include ${token}`).not.toContain(
        token,
      );
    }
  });
});
