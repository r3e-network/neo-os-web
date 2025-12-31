/**
 * Unit tests for particle system configurations
 */
import {
  gamingParticles,
  defiParticles,
  socialParticles,
  governanceParticles,
  nftParticles,
  utilityParticles,
  categoryParticles,
} from "../../../components/features/miniapp/particles/configs";

describe("Particle Configurations", () => {
  describe("Base Configuration Properties", () => {
    const configs = [
      { name: "gaming", config: gamingParticles },
      { name: "defi", config: defiParticles },
      { name: "social", config: socialParticles },
      { name: "governance", config: governanceParticles },
      { name: "nft", config: nftParticles },
      { name: "utility", config: utilityParticles },
    ];

    test.each(configs)("$name config has required base properties", ({ config }) => {
      expect(config.fullScreen).toEqual({ enable: false });
      expect(config.fpsLimit).toBe(60);
      expect(config.detectRetina).toBe(true);
      expect(config.background).toEqual({ color: "transparent" });
    });

    test.each(configs)("$name config has particles configuration", ({ config }) => {
      expect(config.particles).toBeDefined();
      expect(config.particles?.number).toBeDefined();
      expect(config.particles?.color).toBeDefined();
      expect(config.particles?.move).toBeDefined();
    });

    test.each(configs)("$name config has interactivity", ({ config }) => {
      expect(config.interactivity).toBeDefined();
      expect(config.interactivity?.events).toBeDefined();
    });
  });

  describe("Gaming Particles", () => {
    test("has correct particle count", () => {
      expect(gamingParticles.particles?.number?.value).toBe(25);
    });

    test("has purple color palette", () => {
      const colors = gamingParticles.particles?.color?.value;
      expect(colors).toContain("#a855f7");
      expect(colors).toContain("#c084fc");
    });

    test("has shadow effect enabled", () => {
      expect(gamingParticles.particles?.shadow?.enable).toBe(true);
      expect(gamingParticles.particles?.shadow?.color).toBe("#a855f7");
    });

    test("has grab and bubble interactivity", () => {
      const modes = gamingParticles.interactivity?.events?.onHover?.mode;
      expect(modes).toContain("grab");
      expect(modes).toContain("bubble");
    });
  });

  describe("DeFi Particles", () => {
    test("has correct particle count", () => {
      expect(defiParticles.particles?.number?.value).toBe(30);
    });

    test("has cyan color palette", () => {
      const colors = defiParticles.particles?.color?.value;
      expect(colors).toContain("#06b6d4");
      expect(colors).toContain("#22d3ee");
    });

    test("has links with triangles enabled", () => {
      expect(defiParticles.particles?.links?.enable).toBe(true);
      expect(defiParticles.particles?.links?.triangles?.enable).toBe(true);
    });

    test("has bounce outMode", () => {
      expect(defiParticles.particles?.move?.outModes?.default).toBe("bounce");
    });
  });

  describe("Social Particles", () => {
    test("has correct particle count", () => {
      expect(socialParticles.particles?.number?.value).toBe(20);
    });

    test("has pink color palette", () => {
      const colors = socialParticles.particles?.color?.value;
      expect(colors).toContain("#ec4899");
      expect(colors).toContain("#f472b6");
    });

    test("moves upward", () => {
      expect(socialParticles.particles?.move?.direction).toBe("top");
    });

    test("has bubble interactivity", () => {
      expect(socialParticles.interactivity?.events?.onHover?.mode).toBe("bubble");
    });
  });

  describe("Governance Particles", () => {
    test("has correct particle count", () => {
      expect(governanceParticles.particles?.number?.value).toBe(25);
    });

    test("has green color palette", () => {
      const colors = governanceParticles.particles?.color?.value;
      expect(colors).toContain("#10b981");
      expect(colors).toContain("#34d399");
    });

    test("has links enabled", () => {
      expect(governanceParticles.particles?.links?.enable).toBe(true);
      expect(governanceParticles.particles?.links?.distance).toBe(90);
    });

    test("has repulse interactivity", () => {
      expect(governanceParticles.interactivity?.events?.onHover?.mode).toBe("repulse");
    });
  });

  describe("NFT Particles", () => {
    test("has correct particle count", () => {
      expect(nftParticles.particles?.number?.value).toBe(30);
    });

    test("has multi-color palette", () => {
      const colors = nftParticles.particles?.color?.value;
      expect(Array.isArray(colors)).toBe(true);
      expect((colors as string[]).length).toBeGreaterThanOrEqual(5);
    });

    test("has color animation enabled", () => {
      expect(nftParticles.particles?.color?.animation?.enable).toBe(true);
    });

    test("has bubble interactivity", () => {
      expect(nftParticles.interactivity?.events?.onHover?.mode).toBe("bubble");
    });
  });

  describe("Utility Particles", () => {
    test("has correct particle count", () => {
      expect(utilityParticles.particles?.number?.value).toBe(20);
    });

    test("has gray color palette", () => {
      const colors = utilityParticles.particles?.color?.value;
      expect(colors).toContain("#64748b");
      expect(colors).toContain("#94a3b8");
    });

    test("has links enabled", () => {
      expect(utilityParticles.particles?.links?.enable).toBe(true);
    });

    test("has grab interactivity", () => {
      expect(utilityParticles.interactivity?.events?.onHover?.mode).toBe("grab");
    });
  });

  describe("Category Particles Mapping", () => {
    test("exports all category mappings", () => {
      expect(categoryParticles.gaming).toBe(gamingParticles);
      expect(categoryParticles.defi).toBe(defiParticles);
      expect(categoryParticles.social).toBe(socialParticles);
      expect(categoryParticles.governance).toBe(governanceParticles);
      expect(categoryParticles.nft).toBe(nftParticles);
      expect(categoryParticles.utility).toBe(utilityParticles);
    });

    test("has exactly 6 categories", () => {
      expect(Object.keys(categoryParticles)).toHaveLength(6);
    });
  });
});
