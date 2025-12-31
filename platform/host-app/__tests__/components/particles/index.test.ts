/**
 * Unit tests for particles module exports
 */
import React from "react";

// Mock tsparticles modules before importing
jest.mock("@tsparticles/react", () => ({
  __esModule: true,
  default: jest.fn(() => null),
  initParticlesEngine: jest.fn(() => Promise.resolve()),
}));

jest.mock("@tsparticles/slim", () => ({
  loadSlim: jest.fn(() => Promise.resolve()),
}));

import { ParticleBanner, categoryParticles } from "../../../components/features/miniapp/particles";

describe("Particles Module Exports", () => {
  test("exports ParticleBanner component", () => {
    expect(ParticleBanner).toBeDefined();
    expect(typeof ParticleBanner).toBe("function");
  });

  test("exports categoryParticles config", () => {
    expect(categoryParticles).toBeDefined();
    expect(typeof categoryParticles).toBe("object");
  });

  test("categoryParticles has all categories", () => {
    expect(categoryParticles.gaming).toBeDefined();
    expect(categoryParticles.defi).toBeDefined();
    expect(categoryParticles.social).toBeDefined();
    expect(categoryParticles.governance).toBeDefined();
    expect(categoryParticles.nft).toBeDefined();
    expect(categoryParticles.utility).toBeDefined();
  });
});
