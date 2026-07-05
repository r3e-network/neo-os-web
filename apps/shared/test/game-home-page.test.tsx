import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameHomePage } from "../components-react/GameHomePage";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function renderGameHome(overrides: Partial<React.ComponentProps<typeof GameHomePage>> = {}) {
  const onPrimaryClick = vi.fn();
  const onGhostClick = vi.fn();
  const view = render(
    <GameHomePage
      appName="Flappy Dash"
      appLogoUrl="./logo.webp"
      appBannerUrl="./banner.webp"
      heroBadge="On-chain challenge"
      heroTitle="Fly pipes, win GAS"
      heroDesc="Tap through a fair pipe layout and submit the verified result."
      primaryLabel="Start game"
      ghostLabel="How to play"
      onPrimaryClick={onPrimaryClick}
      onGhostClick={onGhostClick}
      stats={[]}
      features={[
        {
          title: "TEE sealed pipes",
          desc: "The run is generated and verified by Morpheus.",
          large: true,
        },
      ]}
      leaderboard={[]}
      ctaTitle="Ready?"
      ctaDesc="Start a run when your wallet is connected."
      rulesPreview={{
        title: "How it works",
        content: "Pick a difficulty, play the scene, then submit the run.",
      }}
      {...overrides}
    />,
  );
  return { ...view, onPrimaryClick, onGhostClick };
}

describe("GameHomePage", () => {
  it("opens rules from the secondary hero action instead of starting the game", () => {
    const { onPrimaryClick, onGhostClick } = renderGameHome();

    expect(screen.queryByText("Pick a difficulty, play the scene, then submit the run.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "How to play" }));

    expect(
      screen.getByText("Pick a difficulty, play the scene, then submit the run."),
    ).toBeTruthy();
    expect(onPrimaryClick).not.toHaveBeenCalled();
    expect(onGhostClick).not.toHaveBeenCalled();
  });

  it("keeps the primary hero action dedicated to starting the game", () => {
    const { onPrimaryClick } = renderGameHome();

    fireEvent.click(screen.getByRole("button", { name: "Start game" }));

    expect(onPrimaryClick).toHaveBeenCalledTimes(1);
  });

  it("renders a game-like launch scene from real app artwork and trust badges", () => {
    const { container } = renderGameHome({
      trustBadges: ["Neo N3", "Wallet signed", "Verified result"],
    });

    const banner = container.querySelector(".n3h-hero-banner") as HTMLImageElement;
    const logo = container.querySelector(".n3h-logo img") as HTMLImageElement;

    expect(container.querySelector(".n3h-shell--game")).toBeTruthy();
    expect(container.querySelector(".n3h-hero-scene")).toBeTruthy();
    expect(banner?.getAttribute("src")).toBe("./banner.webp");
    expect(logo?.getAttribute("src")).toBe("./logo.webp");
    expect(container.querySelector(".n3h-hero-trust")?.textContent).toContain("Verified result");
  });

  it("keeps launch details collapsed so the first screen stays game-first", () => {
    const { container } = renderGameHome({
      features: [
        {
          title: "TEE sealed pipes",
          desc: "The run is generated and verified by Morpheus.",
          large: true,
        },
        {
          title: "Wallet settlement",
          desc: "Submit only after the run is complete.",
        },
      ],
      ctaTitle: "Ready?",
      ctaDesc: "Start a run when your wallet is connected.",
      ctaLabel: "Start game",
    });

    expect(container.querySelector(".n3h-features")).toBeNull();
    expect(container.querySelector(".n3h-cta")).toBeNull();
    expect(screen.queryByText("TEE sealed pipes")).toBeNull();
    expect(screen.queryByText("Ready?")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /How it works/i }));

    expect(screen.getByText("TEE sealed pipes")).toBeTruthy();
    expect(screen.getByText("Wallet settlement")).toBeTruthy();
    expect(screen.getByText("Ready?")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Start game" })).toHaveLength(1);
  });

  it("keeps long detail prose out of the collapsed first screen", () => {
    const { container } = renderGameHome({
      featuresTitle: "",
      ctaTitle: "This is also too long to be used as a compact collapsed hint",
      ctaDesc: "Detailed settlement instructions belong in the expanded details panel.",
      rulesPreview: {
        title: "FogPlay uses a commit reveal flip with escrowed wagers and delayed randomness.",
        content: "The full explanation appears only after the player opens the details.",
      },
    });

    const label = container.querySelector(".n3gh-details-toggle__label")?.textContent ?? "";

    expect(label).toContain("On-chain challenge");
    expect(container.querySelector(".n3gh-details-toggle__hint")).toBeNull();
    expect(screen.queryByText(/commit reveal flip with escrowed wagers/i)).toBeNull();
  });
});
