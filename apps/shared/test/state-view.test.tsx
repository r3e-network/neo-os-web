import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StateView } from "../components/StateView";
import { Skeleton } from "../components/Skeleton";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => {
  cleanup();
});

describe("StateView", () => {
  it("renders an empty state with title, hint and the shared illustration", () => {
    const { container } = render(
      <StateView kind="empty" title="No history yet" hint="Your activity will appear here." />,
    );

    const region = screen.getByRole("status");
    expect(region.textContent).toContain("No history yet");
    expect(region.textContent).toContain("Your activity will appear here.");
    expect(region.className).toContain("ns-state-view--empty");
    // Falls back to the shared EmptyStateArt SVG illustration.
    expect(container.querySelector(".ns-state-view__visual svg")).not.toBeNull();
  });

  it("renders a loading state as a busy status with skeleton placeholders", () => {
    const { container } = render(<StateView kind="loading" title="Loading positions" />);

    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(region.className).toContain("ns-state-view--loading");
    // Skeleton shimmer bars are present and hidden from assistive tech.
    const skeletons = container.querySelectorAll(".ns-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
    skeletons.forEach((node) => expect(node.getAttribute("aria-hidden")).toBe("true"));
  });

  it("renders an error state as an assertive alert with the error illustration", () => {
    const { container } = render(
      <StateView kind="error" title="Could not load data" hint="Please try again." />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Could not load data");
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(alert.className).toContain("ns-state-view--error");
    expect(container.querySelector(".ns-state-view__visual svg")).not.toBeNull();
  });

  it("renders a custom icon and an action, and suppresses the default visual when icon is null", () => {
    const { rerender, container } = render(
      <StateView
        kind="empty"
        title="Connect to continue"
        icon={<span data-testid="custom-icon">star</span>}
        action={<button type="button">Connect wallet</button>}
      />,
    );

    expect(screen.getByTestId("custom-icon")).toBeTruthy();
    const action = container.querySelector(".ns-state-view__action");
    expect(action).not.toBeNull();
    expect(within(action as HTMLElement).getByRole("button").textContent).toBe("Connect wallet");

    rerender(<StateView kind="empty" title="Connect to continue" icon={null} />);
    expect(container.querySelector(".ns-state-view__visual")).toBeNull();
  });
});

describe("Skeleton", () => {
  it("renders a single decorative bar by default", () => {
    const { container } = render(<Skeleton />);
    const bar = container.querySelector(".ns-skeleton");
    expect(bar).not.toBeNull();
    expect(bar?.className).toContain("ns-skeleton--line");
    expect(bar?.getAttribute("aria-hidden")).toBe("true");
  });

  it("stacks multiple bars when count > 1", () => {
    const { container } = render(<Skeleton count={3} />);
    const stack = container.querySelector(".ns-skeleton-stack");
    expect(stack).not.toBeNull();
    expect((stack as HTMLElement).querySelectorAll(".ns-skeleton")).toHaveLength(3);
  });

  it("applies shape and numeric width/height as pixel styles", () => {
    const { container } = render(<Skeleton shape="circle" width={48} height={48} />);
    const bar = container.querySelector(".ns-skeleton") as HTMLElement;
    expect(bar.className).toContain("ns-skeleton--circle");
    expect(bar.style.width).toBe("48px");
    expect(bar.style.height).toBe("48px");
  });
});
