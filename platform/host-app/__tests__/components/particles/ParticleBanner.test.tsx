/**
 * Unit tests for ParticleBanner component
 */
import React from "react";
import { render, waitFor } from "@testing-library/react";

// Mock tsparticles modules
const mockLoadSlim = jest.fn(() => Promise.resolve());
jest.mock("@tsparticles/react", () => ({
  __esModule: true,
  default: jest.fn(({ id, className }) => <div data-testid="particles" id={id} className={className} />),
  initParticlesEngine: jest.fn((callback: (engine: unknown) => Promise<void>) => {
    // Execute the callback to trigger loadSlim
    return callback({}).then(() => Promise.resolve());
  }),
}));

jest.mock("@tsparticles/slim", () => ({
  loadSlim: jest.fn(() => Promise.resolve()),
}));

import { ParticleBanner } from "../../../components/features/miniapp/particles/ParticleBanner";
import { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

describe("ParticleBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("initializes particles engine on mount", async () => {
    render(<ParticleBanner category="gaming" appId="test-app" />);

    await waitFor(() => {
      expect(initParticlesEngine).toHaveBeenCalledTimes(1);
    });
  });

  test("loads slim particles", async () => {
    render(<ParticleBanner category="defi" appId="test-app-2" />);

    await waitFor(() => {
      expect(loadSlim).toHaveBeenCalled();
    });
  });

  test("renders particles with correct id", async () => {
    const { findByTestId } = render(<ParticleBanner category="social" appId="my-app" />);

    const particles = await findByTestId("particles");
    expect(particles).toHaveAttribute("id", "particles-my-app");
  });

  test("applies custom className", async () => {
    const { findByTestId } = render(<ParticleBanner category="nft" appId="nft-app" className="custom-class" />);

    const particles = await findByTestId("particles");
    expect(particles).toHaveClass("custom-class");
  });

  test("renders null before initialization", () => {
    // Mock to never resolve
    (initParticlesEngine as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));

    const { container } = render(<ParticleBanner category="utility" appId="util-app" />);

    expect(container.firstChild).toBeNull();
  });

  test.each(["gaming", "defi", "social", "governance", "nft", "utility"] as const)(
    "accepts %s category",
    async (category) => {
      const { findByTestId } = render(<ParticleBanner category={category} appId={`${category}-app`} />);

      const particles = await findByTestId("particles");
      expect(particles).toBeInTheDocument();
    },
  );
});
